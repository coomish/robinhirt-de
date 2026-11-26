/**
 * Das Zeichenfeld. Ein zweidimensionaler Gauß-Prozess über der Fläche: aus
 * einer verborgenen Landschaft fallen Messpunkte, das Modell sagt für jede
 * Rasterzelle Wert und Unsicherheit voraus. Wo es sicher ist, steht ein
 * kräftiger Strich, dessen Neigung den Wert zeigt; wo Daten fehlen, ein
 * feiner Punkt. Ausreißer (Leave-one-out) sind die einzigen Zeichen in der
 * Akzentfarbe. Messpunkte verblassen, so wandern die Inseln. Alles lokal.
 */
import { gauss, hint, mulberry32, readColors, readout, runLoop, setupCanvas, stillImage, type Rng, type UI, type Unmount } from './ui';

const MAX_POINTS = 80;
const MAX_AGE = 32; // Sekunden
const NOISE = 0.1;
const LENGTH = 0.07; // Längenskala in Breiten
const SIGNAL = 0.5;
const OUTLIER_Z = 3;
const FIT_MS = 140;

interface Pt {
  x: number; // 0..1 (Breite)
  y: number; // 0..aspect
  v: number;
  t: number;
  user: boolean;
  out: boolean;
}

class Truth {
  private k: number[][];
  constructor(rng: Rng) {
    // sechs Wellen in zufälliger Richtung: eine glatte, lebendige Landschaft
    this.k = Array.from({ length: 6 }, () => {
      const a = rng() * Math.PI * 2;
      const f = 1.2 + rng() * 2.2;
      return [Math.cos(a) * f, Math.sin(a) * f, rng() * 6.3, 0.012 + rng() * 0.02];
    });
  }
  at(x: number, y: number, t: number): number {
    let v = 0;
    for (const [kx, ky, ph, w] of this.k) v += Math.sin(2 * Math.PI * (kx * x + ky * y) + ph + w * t);
    return v / 3.2;
  }
}

/** GP mit Cholesky und Leave-one-out; Vorhersage auf dem Raster mit lokaler Varianz */
class GP2 {
  n = 0;
  xs = new Float64Array(MAX_POINTS);
  ys = new Float64Array(MAX_POINTS);
  private vs = new Float64Array(MAX_POINTS);
  private L = new Float64Array(MAX_POINTS * MAX_POINTS);
  Kinv = new Float64Array(MAX_POINTS * MAX_POINTS);
  alpha = new Float64Array(MAX_POINTS);
  looZ = new Float64Array(MAX_POINTS);

  k(ax: number, ay: number, bx: number, by: number): number {
    const dx = (ax - bx) / LENGTH;
    const dy = (ay - by) / LENGTH;
    return SIGNAL * Math.exp(-0.5 * (dx * dx + dy * dy));
  }

  fit(pts: Pt[], mask: (p: Pt) => boolean): boolean {
    let n = 0;
    for (const p of pts) {
      if (!mask(p)) continue;
      this.xs[n] = p.x;
      this.ys[n] = p.y;
      this.vs[n] = p.v;
      n++;
    }
    this.n = n;
    const N = n;
    const L = this.L;
    for (let i = 0; i < N; i++)
      for (let j = 0; j <= i; j++)
        L[i * N + j] = this.k(this.xs[i], this.ys[i], this.xs[j], this.ys[j]) + (i === j ? NOISE * NOISE + 1e-8 : 0);
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
      for (let j = 0; j < N; j++) s += Kinv[i * N + j] * this.vs[j];
      this.alpha[i] = s;
    }
    for (let i = 0; i < N; i++) {
      const kii = Kinv[i * N + i];
      this.looZ[i] = Math.abs(this.alpha[i] / kii) / Math.sqrt(1 / kii);
    }
    return true;
  }

  /** Mittel und Streuung je Zelle; Varianz über die Punkte, die hier noch wirken */
  predict(cols: number, rows: number, cell: number, mu: Float32Array, sd: Float32Array) {
    const N = this.n;
    const ks = new Float64Array(N);
    const idx = new Int32Array(N);
    const sd0 = Math.sqrt(SIGNAL);
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * cell;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cell;
        const g = r * cols + c;
        let m = 0;
        let nl = 0;
        for (let i = 0; i < N; i++) {
          const v = this.k(x, y, this.xs[i], this.ys[i]);
          if (v < 0.004) continue;
          ks[nl] = v;
          idx[nl] = i;
          nl++;
          m += v * this.alpha[i];
        }
        mu[g] = m;
        if (nl === 0) {
          sd[g] = sd0;
          continue;
        }
        let v = SIGNAL;
        for (let a = 0; a < nl; a++) {
          const ia = idx[a];
          let s = 0;
          for (let b = 0; b < nl; b++) s += this.Kinv[ia * N + idx[b]] * ks[b];
          v -= ks[a] * s;
        }
        sd[g] = Math.sqrt(Math.max(v, 1e-6));
      }
    }
  }
}

export const HINWEIS_FELD =
  'Ein Modell für den Betrieb muss wissen, wo es sich nicht sicher ist. Hier füllt sich das Feld, wo es Daten hat. Tipp auf die Fläche und gib ihm welche.';

export function mountField(canvas: HTMLCanvasElement, ui: UI = {}): Unmount {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const ac = new AbortController();
  const signal = ac.signal;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4 || Math.min(screen.width, screen.height) < 500;
  const set = readout(ui, ['Messpunkte', 'Ausreißer', 'Zellen', 'Rechenzeit']);
  hint(ui, HINWEIS_FELD);
  canvas.setAttribute(
    'aria-label',
    'Ein Feld aus kleinen Zeichen: Wo ein lernendes Modell Daten hat, stehen kräftige Striche, wo nicht, feine Punkte. Klick setzt einen Messpunkt.',
  );

  const truth = new Truth(rng);
  const gp = new GP2();
  const pts: Pt[] = [];
  let colors = readColors(canvas);
  let feld = '';
  let W = 0;
  let H = 0;
  let cell = 14;
  let cols = 0;
  let rows = 0;
  let aspect = 1;
  let mu = new Float32Array(0);
  let sd = new Float32Array(0);
  let muShow = new Float32Array(0);
  let sdShow = new Float32Array(0);
  let t = 0;
  let fitMs = 0;
  let dirty = true;
  let outliers = 0;
  let wide = true;

  function readFeld() {
    feld = getComputedStyle(canvas).getPropertyValue('--feld').trim() || colors.graphit;
  }
  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
    cell = weak ? 18 : W > 1600 ? 16 : 14;
    cols = Math.ceil(W / cell) + 1;
    rows = Math.ceil(H / cell) + 1;
    aspect = (rows * cell) / (cols * cell);
    wide = W > 760;
    const n = cols * rows;
    if (mu.length !== n) {
      mu = new Float32Array(n);
      sd = new Float32Array(n).fill(Math.sqrt(SIGNAL));
      muShow = new Float32Array(n);
      sdShow = new Float32Array(n).fill(Math.sqrt(SIGNAL));
    }
    dirty = true;
  }

  // Wo die Punkte fallen: links dünn (dort steht der Text), rechts und mittig dicht
  function sampleXY(): [number, number] {
    for (let k = 0; k < 10; k++) {
      const x = rng();
      const y = rng() * aspect;
      const keep = wide ? 0.08 + 0.92 * Math.pow(x, 1.6) : 0.3 + 0.7 * (1 - y / aspect);
      if (rng() < keep) return [x, y];
    }
    return [rng(), rng() * aspect];
  }
  function addPoint(x: number, y: number, v: number, user: boolean) {
    pts.push({ x, y, v, t, user, out: false });
    while (pts.length > MAX_POINTS) pts.shift();
    dirty = true;
  }
  function observe() {
    const [x, y] = sampleXY();
    const outlier = rng() < 0.05;
    const v = truth.at(x, y, t) + (outlier ? (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.4) : gauss(rng) * NOISE);
    addPoint(x, y, Math.max(-1.3, Math.min(1.3, v)), false);
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
      mu.fill(0);
      sd.fill(Math.sqrt(SIGNAL));
      outliers = 0;
      dirty = false;
      return;
    }
    if (gp.fit(pts, () => true)) {
      let i = 0;
      for (const p of pts) p.out = gp.looZ[i++] > OUTLIER_Z;
    }
    outliers = pts.reduce((a, p) => a + (p.out ? 1 : 0), 0);
    const ok = outliers < pts.length ? gp.fit(pts, (p) => !p.out) : gp.fit(pts, () => true);
    if (ok) gp.predict(cols, rows, cell / W, mu, sd);
    fitMs = performance.now() - t0;
    dirty = false;
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    const sd0 = Math.sqrt(SIGNAL);
    const half = cell / 2;
    c.lineCap = 'butt';
    // Feine Punkte, wo das Modell nichts weiß
    c.fillStyle = colors.blei;
    c.globalAlpha = 0.42;
    for (let r = 0; r < rows; r++) {
      const y = r * cell + half;
      const fade = 1 - Math.max(0, (y / H - 0.72) / 0.28); // läuft nach unten aus
      if (fade <= 0) continue;
      for (let col = 0; col < cols; col++) {
        const g = r * cols + col;
        const cert = 1 - sdShow[g] / sd0;
        if (cert >= 0.3) continue;
        const x = col * cell + half;
        if (fade < 1 && ((col * 7 + r * 13) % 10) / 10 > fade) continue;
        c.fillRect(Math.round(x) - 0.75, Math.round(y) - 0.75, 1.5, 1.5);
      }
    }
    c.globalAlpha = 1;
    // Kräftige Striche: Neigung = Wert, Stärke = Sicherheit
    for (const pass of [0, 1]) {
      c.strokeStyle = feld;
      c.lineWidth = pass ? 2.8 : 1.6;
      c.beginPath();
      for (let r = 0; r < rows; r++) {
        const y = r * cell + half;
        const fade = 1 - Math.max(0, (y / H - 0.72) / 0.28);
        if (fade <= 0) continue;
        for (let col = 0; col < cols; col++) {
          const g = r * cols + col;
          const cert = 1 - sdShow[g] / sd0;
          if (cert < 0.3) continue;
          const strong = cert > 0.65;
          if ((pass === 1) !== strong) continue;
          if (fade < 1 && ((col * 7 + r * 13) % 10) / 10 > fade) continue;
          const x = col * cell + half;
          // links (Desktop) bzw. unten (Handy) steht der Text: dort bleibt das Feld dünn
          const mask = wide ? Math.min(1, Math.max(0.05, (x / W - 0.3) / 0.32)) : y / H > 0.6 ? 0.06 : 1;
          if (mask < 1 && ((col * 3 + r * 5) % 10) / 10 > mask) continue;
          const ang = Math.max(-1, Math.min(1, muShow[g])) * 1.22; // ±70°
          const len = half * (0.45 + 0.5 * cert);
          const dx = Math.cos(ang) * len;
          const dy = -Math.sin(ang) * len;
          c.moveTo(x - dx, y - dy);
          c.lineTo(x + dx, y + dy);
        }
      }
      c.stroke();
    }
    // Messpunkte: Ausreißer als Kreuz in der Akzentfarbe, eigene Punkte mit Ring
    for (const p of pts) {
      const x = p.x * W;
      const y = p.y * W;
      const age = Math.max(0, 1 - (t - p.t) / MAX_AGE);
      if (p.out) {
        c.strokeStyle = colors.signal;
        c.lineWidth = 2;
        c.globalAlpha = 0.4 + 0.6 * age;
        c.beginPath();
        c.moveTo(x - 4, y - 4);
        c.lineTo(x + 4, y + 4);
        c.moveTo(x + 4, y - 4);
        c.lineTo(x - 4, y + 4);
        c.stroke();
      } else if (p.user) {
        c.strokeStyle = feld;
        c.lineWidth = 1.2;
        c.globalAlpha = 0.5 + 0.5 * age;
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 200) return;
    lastReadout = now;
    set([String(pts.length), String(outliers), String(cols * rows), fitMs.toFixed(1) + ' ms']);
  }

  readFeld();
  resize();
  if (!live) {
    for (let k = 0; k < 60; k++) {
      t += 0.4;
      observe();
    }
    refit();
    muShow.set(mu);
    sdShow.set(sd);
    draw();
    updateReadout(0, true);
    const stopStill = stillImage(canvas, () => {
      resize();
      refit();
      muShow.set(mu);
      sdShow.set(sd);
    }, draw);
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
        const interval = since < 3 ? 0.03 + since * 0.08 : 0.32;
        if (t >= nextObs) {
          observe();
          nextObs = t + interval * (0.6 + rng() * 0.8);
        }
        expire();
        if (dirty && now >= nextFit) {
          refit();
          nextFit = now + FIT_MS;
        }
        // weich überblenden
        const a = Math.min(1, dt * 6);
        for (let i = 0; i < mu.length; i++) {
          muShow[i] += (mu[i] - muShow[i]) * a;
          sdShow[i] += (sd[i] - sdShow[i]) * a;
        }
        updateReadout(now);
      },
      draw: () => draw(),
      resize,
      recolor: () => {
        colors = readColors(canvas);
        readFeld();
      },
    },
    reduced,
    signal,
  );

  const local = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / W, y: (ev.clientY - r.top) / W };
  };
  canvas.addEventListener(
    'pointerdown',
    (ev) => {
      const p = local(ev);
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > aspect) return;
      addPoint(p.x, p.y, truth.at(p.x, p.y, t) + gauss(rng) * NOISE * 0.5, true);
      // ein paar Nachbarn dazu, damit sich eine Insel bildet
      for (let k = 0; k < 3; k++) {
        const x = Math.max(0, Math.min(1, p.x + gauss(rng) * 0.03));
        const y = Math.max(0, Math.min(aspect, p.y + gauss(rng) * 0.03));
        addPoint(x, y, truth.at(x, y, t) + gauss(rng) * NOISE, true);
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        for (let k = 0; k < 4; k++) observe();
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
