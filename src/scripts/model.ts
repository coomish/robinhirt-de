/**
 * Das lernende Modell. Aus einer verborgenen Kurve fallen verrauschte Punkte,
 * gelegentlich ein Ausreißer. Ein Gauß-Prozess (RBF-Kern) lernt die Kurve und
 * zeigt seine Unsicherheit als Band: breit, wo Daten fehlen, schmal, wo viele
 * liegen. Ausreißer erkennt er per Leave-one-out: ein Punkt, der ohne sich
 * selbst nicht vorhersagbar wäre, wird markiert und beim Fit ausgelassen.
 * Die Kurve wandert langsam, alte Punkte verblassen: das Modell lernt weiter.
 * Alles lokal im Browser, keine Daten verlassen die Seite.
 */

const MAX_POINTS = 90;
const MAX_AGE = 26; // Sekunden, bis ein Punkt verschwindet
const NOISE = 0.09; // σ des Messrauschens
const LENGTH = 0.11; // Längenskala des Kerns, in Breiten
const SIGNAL = 0.5; // Signalvarianz des Kerns
const GRID = 160; // Stützstellen der Vorhersage
const OUTLIER_Z = 3; // Ausreißer ab so vielen σ (Leave-one-out)

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Point {
  x: number; // 0..1
  y: number;
  t: number; // Sekunden seit Beginn
  user: boolean;
  out: boolean;
}

/** Die verborgene Kurve: glatt, natürlich, langsam wandernd */
class Truth {
  private ph: number[];
  private w = [1.1, 2.3, 3.7];
  private a = [0.42, 0.22, 0.1];
  private rate = [0.07, -0.05, 0.11]; // Drift der Phasen in rad/s
  constructor(rng: Rng) {
    this.ph = [rng() * 6.3, rng() * 6.3, rng() * 6.3];
  }
  at(x: number, t: number): number {
    let y = 0;
    for (let k = 0; k < 3; k++) {
      y += this.a[k] * Math.sin(2 * Math.PI * this.w[k] * x + this.ph[k] + this.rate[k] * t);
    }
    return y;
  }
}

/** Gauß-Prozess mit RBF-Kern und Rauschen, Cholesky, Leave-one-out */
class GP {
  n = 0;
  private xs = new Float64Array(MAX_POINTS);
  private ys = new Float64Array(MAX_POINTS);
  private L = new Float64Array(MAX_POINTS * MAX_POINTS);
  private Kinv = new Float64Array(MAX_POINTS * MAX_POINTS);
  private alpha = new Float64Array(MAX_POINTS);
  readonly mu = new Float64Array(GRID);
  readonly sd = new Float64Array(GRID);
  looZ = new Float64Array(MAX_POINTS);

  private k(a: number, b: number): number {
    const d = (a - b) / LENGTH;
    return SIGNAL * Math.exp(-0.5 * d * d);
  }

  /** Passt an die Punkte an, deren mask true ist. Liefert false bei numerischem Problem. */
  fit(pts: Point[], mask: (p: Point) => boolean): boolean {
    let n = 0;
    for (const p of pts) {
      if (!mask(p)) continue;
      this.xs[n] = p.x;
      this.ys[n] = p.y;
      n++;
    }
    this.n = n;
    const N = n;
    const L = this.L;
    // K = k(X,X) + σ² I, in L (unteres Dreieck wird überschrieben)
    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= i; j++) {
        L[i * N + j] = this.k(this.xs[i], this.xs[j]) + (i === j ? NOISE * NOISE + 1e-8 : 0);
      }
    }
    // Cholesky
    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= i; j++) {
        let s = L[i * N + j];
        for (let m = 0; m < j; m++) s -= L[i * N + m] * L[j * N + m];
        if (i === j) {
          if (s <= 0) return false;
          L[i * N + i] = Math.sqrt(s);
        } else {
          L[i * N + j] = s / L[j * N + j];
        }
      }
    }
    // K⁻¹ über L: löse für jede Einheitsspalte
    const Kinv = this.Kinv;
    const col = new Float64Array(N);
    for (let c = 0; c < N; c++) {
      for (let i = 0; i < N; i++) {
        let s = i === c ? 1 : 0;
        for (let m = 0; m < i; m++) s -= L[i * N + m] * col[m];
        col[i] = s / L[i * N + i];
      }
      for (let i = N - 1; i >= 0; i--) {
        let s = col[i];
        for (let m = i + 1; m < N; m++) s -= L[m * N + i] * col[m];
        col[i] = s / L[i * N + i];
      }
      for (let i = 0; i < N; i++) Kinv[i * N + c] = col[i];
    }
    // alpha = K⁻¹ y
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += Kinv[i * N + j] * this.ys[j];
      this.alpha[i] = s;
    }
    // Leave-one-out: μ₋ᵢ = yᵢ − αᵢ / K⁻¹ᵢᵢ, σ²₋ᵢ = 1 / K⁻¹ᵢᵢ
    for (let i = 0; i < N; i++) {
      const kii = Kinv[i * N + i];
      this.looZ[i] = Math.abs(this.alpha[i] / kii) / Math.sqrt(1 / kii);
    }
    return true;
  }

  /** Vorhersage auf dem Raster 0..1 */
  predict() {
    const N = this.n;
    const kstar = new Float64Array(N);
    for (let g = 0; g < GRID; g++) {
      const x = g / (GRID - 1);
      let m = 0;
      for (let i = 0; i < N; i++) {
        kstar[i] = this.k(x, this.xs[i]);
        m += kstar[i] * this.alpha[i];
      }
      let v = SIGNAL;
      for (let i = 0; i < N; i++) {
        let s = 0;
        for (let j = 0; j < N; j++) s += this.Kinv[i * N + j] * kstar[j];
        v -= kstar[i] * s;
      }
      this.mu[g] = m;
      this.sd[g] = Math.sqrt(Math.max(v, 1e-9));
    }
  }

  /** Wert und Streuung an beliebiger Stelle, aus dem Raster interpoliert */
  at(x: number): { mu: number; sd: number } {
    const f = Math.max(0, Math.min(1, x)) * (GRID - 1);
    const i = Math.floor(f);
    const j = Math.min(GRID - 1, i + 1);
    const w = f - i;
    return { mu: this.mu[i] * (1 - w) + this.mu[j] * w, sd: this.sd[i] * (1 - w) + this.sd[j] * w };
  }
}

interface Colors {
  graphit: string;
  blei: string;
  raster: string;
  bernstein: string;
  band: string;
  papier: string;
}

function readColors(el: HTMLElement): Colors {
  const cs = getComputedStyle(el);
  const get = (n: string) => cs.getPropertyValue(n).trim();
  return {
    graphit: get('--graphit'),
    blei: get('--blei'),
    raster: get('--raster'),
    bernstein: get('--bernstein'),
    band: get('--band'),
    papier: get('--papier'),
  };
}

export interface Readout {
  points?: HTMLElement | null;
  outliers?: HTMLElement | null;
  uncertainty?: HTMLElement | null;
  time?: HTMLElement | null;
}

const fmt = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const MONO = '500 11px "JetBrains Mono", ui-monospace, monospace';
const RANGE = 1.15; // Wertebereich, der die Höhe füllt

export function mountModel(canvas: HTMLCanvasElement, readout: Readout = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);

  const truth = new Truth(rng);
  const gp = new GP();
  const pts: Point[] = [];
  let colors = readColors(canvas);
  let t = 0;
  let fitMs = 0;
  let dirty = true;
  let outliers = 0;

  let W = 0;
  let H = 0;
  let dpr = 1;
  const padX = 24;
  const padY = 22;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const xOf = (x: number) => padX + x * (W - 2 * padX);
  const yOf = (v: number) => H / 2 - (v / RANGE) * (H / 2 - padY);
  const xTo = (px: number) => (px - padX) / (W - 2 * padX);
  const vTo = (py: number) => ((H / 2 - py) / (H / 2 - padY)) * RANGE;

  // ---- Daten ------------------------------------------------------------
  let gap = rng(); // Region mit wenig Daten, wandert langsam
  function sampleX(): number {
    // Ablehnungsmethode: in der Lücke seltener beobachten
    for (let k = 0; k < 8; k++) {
      const x = rng();
      const d = Math.abs(x - gap);
      const keep = 1 - 0.85 * Math.exp(-(d * d) / 0.012);
      if (rng() < keep) return x;
    }
    return rng();
  }
  function addPoint(x: number, y: number, user: boolean) {
    pts.push({ x, y, t, user, out: false });
    while (pts.length > MAX_POINTS) pts.shift();
    dirty = true;
  }
  function observe() {
    const x = sampleX();
    const outlier = rng() < 0.06;
    const y = truth.at(x, t) + (outlier ? (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.4) : gauss(rng) * NOISE);
    addPoint(x, Math.max(-RANGE, Math.min(RANGE, y)), false);
  }
  function expire() {
    let changed = false;
    while (pts.length && t - pts[0].t > MAX_AGE) {
      pts.shift();
      changed = true;
    }
    // Reihenfolge ist nicht streng nach Zeit (Hand-Punkte), deshalb auch innen prüfen
    for (let i = pts.length - 1; i >= 0; i--) {
      if (t - pts[i].t > MAX_AGE) {
        pts.splice(i, 1);
        changed = true;
      }
    }
    if (changed) dirty = true;
  }

  function refit() {
    const t0 = performance.now();
    if (pts.length === 0) {
      gp.n = 0;
      gp.mu.fill(0);
      gp.sd.fill(Math.sqrt(SIGNAL));
      outliers = 0;
      fitMs = 0;
      dirty = false;
      return;
    }
    // Erster Durchlauf mit allen Punkten, Ausreißer per Leave-one-out
    if (gp.fit(pts, () => true)) {
      let i = 0;
      for (const p of pts) p.out = gp.looZ[i++] > OUTLIER_Z;
    }
    outliers = pts.reduce((a, p) => a + (p.out ? 1 : 0), 0);
    // Zweiter Durchlauf ohne Ausreißer
    const ok = outliers < pts.length ? gp.fit(pts, (p) => !p.out) : gp.fit(pts, () => true);
    if (ok) gp.predict();
    fitMs = performance.now() - t0;
    dirty = false;
  }

  // ---- Zeichnen -----------------------------------------------------------
  let hover: { x: number; y: number } | null = null;

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';

    // Skala unten: zehn Striche
    c.strokeStyle = colors.raster;
    c.lineWidth = 1;
    c.beginPath();
    for (let k = 0; k <= 10; k++) {
      const x = Math.round(xOf(k / 10)) + 0.5;
      c.moveTo(x, H - (k % 5 === 0 ? 9 : 5));
      c.lineTo(x, H);
    }
    c.stroke();

    if (gp.n > 0) {
      // Band: ±2σ und ±1σ
      for (const z of [2, 1]) {
        c.beginPath();
        for (let g = 0; g < GRID; g++) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g] + z * gp.sd[g]));
        for (let g = GRID - 1; g >= 0; g--) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g] - z * gp.sd[g]));
        c.closePath();
        c.fillStyle = colors.band;
        c.fill();
      }
      // Mittlere Kurve
      c.beginPath();
      for (let g = 0; g < GRID; g++) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g]));
      c.strokeStyle = colors.graphit;
      c.lineWidth = 1.6;
      c.lineJoin = 'round';
      c.stroke();
    }

    // Punkte, nach Alter verblassend; Ausreißer in Bernstein
    for (const p of pts) {
      const age = (t - p.t) / MAX_AGE;
      const a = 0.18 + 0.82 * Math.max(0, 1 - age);
      c.globalAlpha = p.out ? Math.max(a, 0.55) : a;
      c.fillStyle = p.out ? colors.bernstein : colors.graphit;
      c.beginPath();
      c.arc(xOf(p.x), yOf(p.y), p.out ? 3.4 : 2.6, 0, Math.PI * 2);
      c.fill();
      if (p.user) {
        c.strokeStyle = c.fillStyle;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(xOf(p.x), yOf(p.y), 6, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    // Messcursor: Vorhersage unter dem Zeiger
    if (hover && gp.n > 0) {
      const x = Math.max(0, Math.min(1, xTo(hover.x)));
      const { mu, sd } = gp.at(x);
      const px = Math.round(xOf(x)) + 0.5;
      c.strokeStyle = colors.blei;
      c.globalAlpha = 0.6;
      c.beginPath();
      c.moveTo(px, 0);
      c.lineTo(px, H - 12);
      c.stroke();
      c.globalAlpha = 1;
      const left = px > W - 120;
      c.textAlign = left ? 'right' : 'left';
      const dx = left ? -8 : 8;
      c.fillStyle = colors.graphit;
      c.beginPath();
      c.arc(px, yOf(mu), 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = colors.blei;
      c.fillText(`${fmt(mu)} ± ${sd.toFixed(2)}`, px + dx, yOf(mu) - 12);
    }
  }

  // ---- Anzeige ------------------------------------------------------------
  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    if (readout.points) readout.points.textContent = String(pts.length);
    if (readout.outliers) readout.outliers.textContent = String(outliers);
    if (readout.uncertainty) {
      let s = 0;
      for (let g = 0; g < GRID; g++) s += gp.sd[g];
      readout.uncertainty.textContent = '±' + (s / GRID).toFixed(2);
    }
    if (readout.time) readout.time.textContent = fitMs.toFixed(1) + ' ms';
  }

  // ---- Standbild bei reduzierter Bewegung ----------------------------------
  resize();
  if (!live) {
    for (let k = 0; k < 60; k++) {
      t += 0.35;
      observe();
    }
    refit();
    draw();
    updateReadout(0, true);
    new ResizeObserver(() => {
      resize();
      draw();
    }).observe(canvas);
    return;
  }

  // ---- Laufender Betrieb ---------------------------------------------------
  let last = 0;
  let raf = 0;
  let visible = true;
  let running = false;
  let nextObs = 0;
  let nextFit = 0;
  const start0 = performance.now();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    // Der Moment beim Laden: die ersten Punkte kommen schnell, dann ruhig
    const since = (now - start0) / 1000;
    const interval = since < 2.5 ? 0.045 + since * 0.1 : 0.45;
    if (t >= nextObs) {
      observe();
      nextObs = t + interval * (0.7 + rng() * 0.6);
    }
    gap += dt * 0.012;
    if (gap > 1) gap -= 1;
    expire();
    if (dirty && now >= nextFit) {
      refit();
      nextFit = now + 60;
    }
    draw();
    updateReadout(now);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }
  start();

  new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) start();
      else stop();
    },
    { threshold: 0.05 },
  ).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new ResizeObserver(() => {
    resize();
    if (!running) {
      draw();
      updateReadout(performance.now(), true);
    }
  }).observe(canvas);
  const recolor = () => {
    colors = readColors(canvas);
    if (!running) draw();
  };
  new MutationObserver(recolor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  reduced.addEventListener('change', () => (reduced.matches ? stop() : start()));
  if (document.fonts?.load) document.fonts.load(MONO).catch(() => undefined);

  // ---- Eingreifen: Zeiger, Finger, Tastatur -----------------------------
  const local = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  let lastDrag: { x: number; y: number } | null = null;
  const place = (p: { x: number; y: number }) => {
    const x = xTo(p.x);
    if (x < 0 || x > 1) return;
    addPoint(x, Math.max(-RANGE, Math.min(RANGE, vTo(p.y))), true);
  };
  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    hover = p;
    if (ev.buttons > 0 && lastDrag && Math.hypot(p.x - lastDrag.x, p.y - lastDrag.y) > 14) {
      place(p);
      lastDrag = p;
    }
  });
  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev);
    place(p);
    lastDrag = p;
    hover = p;
  });
  const release = () => {
    lastDrag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    lastDrag = null;
    hover = null;
  });
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      observe();
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const x = rng();
      const sign = ev.key === 'ArrowUp' ? 1 : -1;
      addPoint(x, Math.max(-RANGE, Math.min(RANGE, truth.at(x, t) + sign * 0.6)), true);
    }
  });
}
