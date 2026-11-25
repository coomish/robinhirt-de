/**
 * Das lernende Modell. Aus einer verborgenen Kurve fallen verrauschte Punkte,
 * gelegentlich ein Ausreißer. Ein Gauß-Prozess (RBF-Kern) lernt die Kurve.
 * Gezeichnet wird nicht nur der Mittelwert, sondern ein Fächer von Kurven, die
 * das Modell für möglich hält: eng, wo Daten liegen, weit, wo sie fehlen.
 * Ausreißer erkennt er per Leave-one-out und lässt sie beim Fit aus. Die
 * Kurve wandert langsam, alte Punkte verblassen: das Modell lernt weiter.
 */
import { gauss, hint, mulberry32, readColors, readout, runLoop, setupCanvas, stillImage, fmt, MONO, type Colors, type Rng, type UI, type Unmount } from './ui';

const MAX_POINTS = 90;
const MAX_AGE = 26; // Sekunden, bis ein Punkt verschwindet
const NOISE = 0.09; // σ des Messrauschens
const LENGTH = 0.11; // Längenskala des Kerns, in Breiten
const SIGNAL = 0.5; // Signalvarianz des Kerns
const GRID = 140; // Stützstellen der Vorhersage
const SAMPLES = 24; // Kurven aus der Nachverteilung
const OUTLIER_Z = 3; // Ausreißer ab so vielen σ (Leave-one-out)
const RANGE = 1.05;

export const HINWEIS_MODELL =
  'Ein Gauß-Prozess lernt live eine verborgene Kurve; der Fächer zeigt, was er für möglich hält, Türkis, was nicht passt. Klick setzt Punkte.';

export interface Point {
  x: number;
  y: number;
  t: number;
  user: boolean;
  out: boolean;
}

class Truth {
  private ph: number[];
  private w = [1.1, 2.3, 3.7];
  private a = [0.58, 0.3, 0.14];
  private rate = [0.02, -0.012, 0.03];
  constructor(rng: Rng) {
    this.ph = [rng() * 6.3, rng() * 6.3, rng() * 6.3];
  }
  at(x: number, t: number): number {
    let y = 0;
    for (let k = 0; k < 3; k++) y += this.a[k] * Math.sin(2 * Math.PI * this.w[k] * x + this.ph[k] + this.rate[k] * t);
    return y;
  }
}

/** Gauß-Prozess mit RBF-Kern, Cholesky, Leave-one-out, Stichproben der Nachverteilung */
class GP {
  n = 0;
  private xs = new Float64Array(MAX_POINTS);
  private ys = new Float64Array(MAX_POINTS);
  private L = new Float64Array(MAX_POINTS * MAX_POINTS);
  private Kinv = new Float64Array(MAX_POINTS * MAX_POINTS);
  private alpha = new Float64Array(MAX_POINTS);
  private kstar = new Float64Array(MAX_POINTS * GRID);
  private A = new Float64Array(MAX_POINTS * GRID);
  private cov = new Float64Array(GRID * GRID);
  readonly mu = new Float64Array(GRID);
  readonly sd = new Float64Array(GRID);
  readonly samples = new Float32Array(SAMPLES * GRID);
  haveSamples = false;
  looZ = new Float64Array(MAX_POINTS);

  private k(a: number, b: number): number {
    const d = (a - b) / LENGTH;
    return SIGNAL * Math.exp(-0.5 * d * d);
  }

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
    for (let i = 0; i < N; i++)
      for (let j = 0; j <= i; j++) L[i * N + j] = this.k(this.xs[i], this.xs[j]) + (i === j ? NOISE * NOISE + 1e-8 : 0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= i; j++) {
        let s = L[i * N + j];
        for (let m = 0; m < j; m++) s -= L[i * N + m] * L[j * N + m];
        if (i === j) {
          if (s <= 0) return false;
          L[i * N + i] = Math.sqrt(s);
        } else L[i * N + j] = s / L[j * N + j];
      }
    }
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
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += Kinv[i * N + j] * this.ys[j];
      this.alpha[i] = s;
    }
    for (let i = 0; i < N; i++) {
      const kii = Kinv[i * N + i];
      this.looZ[i] = Math.abs(this.alpha[i] / kii) / Math.sqrt(1 / kii);
    }
    return true;
  }

  /** Mittelwert, Streuung und Nachverteilung auf dem Raster; z: feste Zufallszahlen */
  predict(z: Float64Array) {
    const N = this.n;
    const ks = this.kstar;
    for (let g = 0; g < GRID; g++) {
      const x = g / (GRID - 1);
      let m = 0;
      for (let i = 0; i < N; i++) {
        const v = this.k(x, this.xs[i]);
        ks[i * GRID + g] = v;
        m += v * this.alpha[i];
      }
      this.mu[g] = m;
    }
    // A = K⁻¹ K*
    const A = this.A;
    for (let i = 0; i < N; i++) {
      for (let g = 0; g < GRID; g++) {
        let s = 0;
        for (let j = 0; j < N; j++) s += this.Kinv[i * N + j] * ks[j * GRID + g];
        A[i * GRID + g] = s;
      }
    }
    // Σ = K** − K*ᵀ A, nur unteres Dreieck
    const C = this.cov;
    for (let g = 0; g < GRID; g++) {
      for (let h = 0; h <= g; h++) {
        let s = this.k(g / (GRID - 1), h / (GRID - 1));
        for (let i = 0; i < N; i++) s -= ks[i * GRID + g] * A[i * GRID + h];
        C[g * GRID + h] = s + (g === h ? 1e-5 : 0);
      }
      this.sd[g] = Math.sqrt(Math.max(C[g * GRID + g], 1e-9));
    }
    // Cholesky von Σ, dann Stichproben f = μ + L z
    for (let g = 0; g < GRID; g++) {
      for (let h = 0; h <= g; h++) {
        let s = C[g * GRID + h];
        for (let m = 0; m < h; m++) s -= C[g * GRID + m] * C[h * GRID + m];
        if (g === h) {
          if (s <= 0) {
            this.haveSamples = false;
            return;
          }
          C[g * GRID + g] = Math.sqrt(s);
        } else C[g * GRID + h] = s / C[h * GRID + h];
      }
    }
    for (let sIdx = 0; sIdx < SAMPLES; sIdx++) {
      for (let g = 0; g < GRID; g++) {
        let v = this.mu[g];
        for (let h = 0; h <= g; h++) v += C[g * GRID + h] * z[sIdx * GRID + h];
        this.samples[sIdx * GRID + g] = v;
      }
    }
    this.haveSamples = true;
  }

  at(x: number): { mu: number; sd: number } {
    const f = Math.max(0, Math.min(1, x)) * (GRID - 1);
    const i = Math.floor(f);
    const j = Math.min(GRID - 1, i + 1);
    const w = f - i;
    return { mu: this.mu[i] * (1 - w) + this.mu[j] * w, sd: this.sd[i] * (1 - w) + this.sd[j] * w };
  }
}

export function mountModel(canvas: HTMLCanvasElement, ui: UI = {}): Unmount {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const ac = new AbortController();
  const signal = ac.signal;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const set = readout(ui, ['Punkte', 'Ausreißer', 'Unsicherheit', 'Rechenzeit']);
  hint(ui, (live ? HINWEIS_MODELL : 'Standbild bei reduzierter Bewegung: ' + HINWEIS_MODELL) + ' Synthetisch, gerechnet lokal im Browser.');
  canvas.setAttribute('aria-label', 'Ein Modell lernt live eine verborgene Kurve aus verrauschten Punkten und zeigt, welche Kurven es für möglich hält');

  const truth = new Truth(rng);
  const gp = new GP();
  const z = new Float64Array(SAMPLES * GRID);
  for (let i = 0; i < z.length; i++) z[i] = gauss(rng);
  const pts: Point[] = [];
  let colors: Colors = readColors(canvas);
  let t = 0;
  let fitMs = 0;
  let dirty = true;
  let outliers = 0;
  let W = 0;
  let H = 0;
  const padX = 0;
  const padY = 10;

  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
  }
  const xOf = (x: number) => padX + x * (W - 2 * padX);
  const yOf = (v: number) => H / 2 - (v / RANGE) * (H / 2 - padY);
  const xTo = (px: number) => (px - padX) / (W - 2 * padX);
  const vTo = (py: number) => ((H / 2 - py) / (H / 2 - padY)) * RANGE;

  let gap = rng();
  function sampleX(): number {
    for (let k = 0; k < 8; k++) {
      const x = rng();
      const d = Math.abs(x - gap);
      if (rng() < 1 - 0.85 * Math.exp(-(d * d) / 0.012)) return x;
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
    for (let i = pts.length - 1; i >= 0; i--) {
      if (t - pts[i].t > MAX_AGE) {
        pts.splice(i, 1);
        dirty = true;
      }
    }
  }
  function refit() {
    const t0 = performance.now();
    if (pts.length === 0) {
      gp.n = 0;
      gp.mu.fill(0);
      gp.sd.fill(Math.sqrt(SIGNAL));
      gp.haveSamples = false;
      outliers = 0;
      fitMs = 0;
      dirty = false;
      return;
    }
    if (gp.fit(pts, () => true)) {
      let i = 0;
      for (const p of pts) p.out = gp.looZ[i++] > OUTLIER_Z;
    }
    outliers = pts.reduce((a, p) => a + (p.out ? 1 : 0), 0);
    const ok = outliers < pts.length ? gp.fit(pts, (p) => !p.out) : gp.fit(pts, () => true);
    if (ok) gp.predict(z);
    fitMs = performance.now() - t0;
    dirty = false;
  }

  let hover: { x: number; y: number } | null = null;

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';
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
      // Band ±2σ, leicht
      c.beginPath();
      for (let g = 0; g < GRID; g++) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g] + 2 * gp.sd[g]));
      for (let g = GRID - 1; g >= 0; g--) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g] - 2 * gp.sd[g]));
      c.closePath();
      c.fillStyle = colors.band;
      c.fill();
      // Fächer möglicher Kurven
      if (gp.haveSamples) {
        c.strokeStyle = colors.graphit;
        c.lineWidth = 0.8;
        c.globalAlpha = 0.22;
        c.lineJoin = 'round';
        for (let s = 0; s < SAMPLES; s++) {
          c.beginPath();
          for (let g = 0; g < GRID; g++) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.samples[s * GRID + g]));
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      // Mittlere Kurve
      c.beginPath();
      for (let g = 0; g < GRID; g++) c.lineTo(xOf(g / (GRID - 1)), yOf(gp.mu[g]));
      c.strokeStyle = colors.graphit;
      c.lineWidth = 1.8;
      c.stroke();
    }
    for (const p of pts) {
      const age = (t - p.t) / MAX_AGE;
      const a = 0.2 + 0.8 * Math.max(0, 1 - age);
      c.globalAlpha = p.out ? Math.max(a, 0.6) : a;
      c.fillStyle = p.out ? colors.signal : colors.graphit;
      c.beginPath();
      c.arc(xOf(p.x), yOf(p.y), p.out ? 3.6 : 2.8, 0, Math.PI * 2);
      c.fill();
      if (p.user) {
        c.strokeStyle = c.fillStyle;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(xOf(p.x), yOf(p.y), 6.5, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
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

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    let s = 0;
    for (let g = 0; g < GRID; g++) s += gp.sd[g];
    set([String(pts.length), String(outliers), '±' + (s / GRID).toFixed(2), fitMs.toFixed(1) + ' ms']);
  }

  resize();
  if (!live) {
    for (let k = 0; k < 60; k++) {
      t += 0.35;
      observe();
    }
    refit();
    draw();
    updateReadout(0, true);
    const stopStill = stillImage(canvas, resize, draw);
    return () => {
      stopStill();
      ac.abort();
    };
  }

  let nextObs = 0;
  let nextFit = 0;
  const start0 = performance.now();
  const stopLoop = runLoop(
    canvas,
    {
      frame(dt, now) {
        t += dt;
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
          nextFit = now + 70;
        }
        updateReadout(now);
      },
      draw: () => draw(),
      resize,
      recolor: () => {
        colors = readColors(canvas);
      },
    },
    reduced,
    signal,
  );

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
  canvas.addEventListener(
    'pointermove',
    (ev) => {
      const p = local(ev);
      hover = p;
      if (ev.buttons > 0 && lastDrag && Math.hypot(p.x - lastDrag.x, p.y - lastDrag.y) > 14) {
        place(p);
        lastDrag = p;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (ev) => {
      const p = local(ev);
      place(p);
      lastDrag = p;
      hover = p;
    },
    { signal },
  );
  const release = () => (lastDrag = null);
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener(
    'pointerleave',
    () => {
      lastDrag = null;
      hover = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        observe();
      } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const x = rng();
        const sign = ev.key === 'ArrowUp' ? 1 : -1;
        addPoint(x, Math.max(-RANGE, Math.min(RANGE, truth.at(x, t) + sign * 0.6)), true);
      }
    },
    { signal },
  );
  return () => {
    stopLoop();
    ac.abort();
    ctx.clearRect(0, 0, W, H);
  };
}
