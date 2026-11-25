/**
 * Vorhersage gegen Wirklichkeit. Ein chaotisches System (Lorenz) läuft als
 * Spur; rechts zeichnet es seinen Schmetterling. Fünf autoregressive Modelle
 * verschiedener Ordnung lernen laufend aus den letzten Sekunden und sagen
 * 0,5 s voraus, als Fächer vor dem Jetzt. Gestrichelt läuft mit, was für
 * jeden Moment vorhergesagt war; Türkis, wo die Wirklichkeit es verfehlt.
 */
import { gauss, hint, mulberry32, readColors, readout, runLoop, setupCanvas, stillImage, fmt, MONO, type Colors, type Rng, type UI, type Unmount } from './ui';

const RATE = 50;
const DT = 1 / RATE;
const HORIZON = 0.5;
const HN = Math.round(HORIZON * RATE);
const ORDERS = [8, 12, 16, 24, 32];
const WINDOWS = [200, 250, 300, 350, 400];
const MAIN = 2;
const FIT_EVERY = 5;
const MAX_SECONDS = 14;
const CAP = (MAX_SECONDS + HORIZON) * RATE + 8;
const TOL = 0.12;
const SCALE = 19;
const TRAIL = 2400; // Zustände für den Schmetterling

export const HINWEIS_VORHERSAGE =
  'Ein chaotisches System (Lorenz) läuft, fünf Modelle sagen 0,5 s voraus; Türkis, wo die Wirklichkeit sie verfehlt. Maus zieht, Klick stößt an.';

class Lorenz {
  x: number;
  y: number;
  z = 20;
  constructor(rng: Rng) {
    this.x = 1 + gauss(rng);
    this.y = 1 + gauss(rng);
  }
  private d(x: number, y: number, z: number) {
    return [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  }
  step(h: number) {
    const { x, y, z } = this;
    const k1 = this.d(x, y, z);
    const k2 = this.d(x + (h / 2) * k1[0], y + (h / 2) * k1[1], z + (h / 2) * k1[2]);
    const k3 = this.d(x + (h / 2) * k2[0], y + (h / 2) * k2[1], z + (h / 2) * k2[2]);
    const k4 = this.d(x + h * k3[0], y + h * k3[1], z + h * k3[2]);
    this.x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    this.y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    this.z += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  }
}

class AR {
  coef: Float64Array;
  ok = false;
  constructor(readonly P: number) {
    this.coef = new Float64Array(P + 1);
  }
  fit(series: (k: number) => number, n: number): boolean {
    const P = this.P;
    const M = P + 1;
    const A = new Float64Array(M * M);
    const b = new Float64Array(M);
    const row = new Float64Array(M);
    const rows = n - P;
    if (rows < 40) return (this.ok = false);
    for (let t = P; t < n; t++) {
      for (let k = 0; k < P; k++) row[k] = series(t - 1 - k);
      row[P] = 1;
      const y = series(t);
      for (let i = 0; i < M; i++) {
        b[i] += row[i] * y;
        for (let j = 0; j <= i; j++) A[i * M + j] += row[i] * row[j];
      }
    }
    for (let i = 0; i < M; i++) A[i * M + i] += 1e-3 * rows;
    for (let i = 0; i < M; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i * M + j];
        for (let m = 0; m < j; m++) s -= A[i * M + m] * A[j * M + m];
        if (i === j) {
          if (s <= 0) return (this.ok = false);
          A[i * M + i] = Math.sqrt(s);
        } else A[i * M + j] = s / A[j * M + j];
      }
    }
    const c = this.coef;
    for (let i = 0; i < M; i++) {
      let s = b[i];
      for (let m = 0; m < i; m++) s -= A[i * M + m] * c[m];
      c[i] = s / A[i * M + i];
    }
    for (let i = M - 1; i >= 0; i--) {
      let s = c[i];
      for (let m = i + 1; m < M; m++) s -= A[m * M + i] * c[m];
      c[i] = s / A[i * M + i];
    }
    return (this.ok = true);
  }
  forecast(series: (k: number) => number, out: Float32Array) {
    const P = this.P;
    const hist = new Float64Array(P);
    for (let k = 0; k < P; k++) hist[k] = series(k);
    for (let h = 0; h < HN; h++) {
      let y = this.coef[P];
      for (let k = 0; k < P; k++) y += this.coef[k] * hist[k];
      y = Math.max(-1.3, Math.min(1.3, y));
      out[h] = y;
      for (let k = P - 1; k > 0; k--) hist[k] = hist[k - 1];
      hist[0] = y;
    }
  }
}

export function mountForecast(canvas: HTMLCanvasElement, ui: UI = {}): Unmount {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const ac = new AbortController();
  const signal = ac.signal;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const set = readout(ui, ['Horizont', 'Fehler am Horizont', 'Verfehlt', 'Rechenzeit']);
  hint(ui, (live ? HINWEIS_VORHERSAGE : 'Standbild bei reduzierter Bewegung: ' + HINWEIS_VORHERSAGE) + ' Synthetisch, gerechnet lokal im Browser.');
  canvas.setAttribute('aria-label', 'Ein chaotisches System läuft als Spur und zeichnet seinen Schmetterling; Modelle sagen eine halbe Sekunde voraus, Abweichungen werden markiert');

  const lor = new Lorenz(rng);
  const models = ORDERS.map((p) => new AR(p));
  let colors: Colors = readColors(canvas);

  const v = new Float32Array(CAP);
  const pred = new Float32Array(CAP);
  const predFor = new Int32Array(CAP).fill(-1);
  let count = 0;
  const slot = (abs: number) => ((abs % CAP) + CAP) % CAP;
  const at = (k: number) => v[slot(count - 1 - k)];

  const trajs: Float32Array[] = Array.from({ length: HN + FIT_EVERY + 2 }, () => new Float32Array(HN));
  const trajAt = new Int32Array(trajs.length).fill(-1);
  const errH = new Float32Array(HN).fill(0.06);
  const cur = models.map(() => new Float32Array(HN));
  let haveCur = false;
  let misses = 0;
  let calm = 1e9;
  let missNow = false;
  let fitMs = 0;
  let target: number | null = null;
  let impulse = 0;
  // Schmetterling: x–z-Projektion der letzten Zustände
  const tx = new Float32Array(TRAIL);
  const tz = new Float32Array(TRAIL);
  let th = 0;
  let tn = 0;

  let W = 0;
  let H = 0;
  let Wp = 0; // Breite der Zeitspur
  let seconds = 10;
  let pxPerSample = 2;
  const padY = 10;
  const xNow = () => Wp - 16 - HN * pxPerSample;
  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
    Wp = W > 720 ? Math.round(W * 0.66) : W;
    seconds = Math.min(MAX_SECONDS, Math.max(5, Wp / 80));
    pxPerSample = (Wp - 24) / (seconds * RATE + HN);
  }
  const yOf = (x: number) => H / 2 - x * (H / 2 - padY);
  const vOf = (y: number) => (H / 2 - y) / (H / 2 - padY);

  function tick() {
    if (target !== null) lor.x += (target * SCALE - lor.x) * 0.12;
    lor.x += impulse;
    impulse *= 0.8;
    for (let s = 0; s < 2; s++) lor.step(0.0025);
    tx[th] = lor.x;
    tz[th] = lor.z;
    th = (th + 1) % TRAIL;
    if (tn < TRAIL) tn++;
    const x = Math.max(-1.3, Math.min(1.3, lor.x / SCALE));
    const abs = count;
    v[slot(abs)] = x;
    count++;
    for (let h = 1; h <= HN; h++) {
      const issued = abs - h;
      const ti = ((issued % trajs.length) + trajs.length) % trajs.length;
      if (trajAt[ti] !== issued) continue;
      const e = Math.abs(x - trajs[ti][h - 1]);
      errH[h - 1] += (e - errH[h - 1]) * 0.03;
    }
    const p = predFor[slot(abs)] === abs ? pred[slot(abs)] : NaN;
    missNow = !Number.isNaN(p) && Math.abs(x - p) > TOL;
    if (missNow && calm >= 25) misses++;
    calm = missNow ? 0 : calm + 1;

    if (count % FIT_EVERY === 0 && count >= 72) {
      const t0 = performance.now();
      models.forEach((m, i) => {
        const n = Math.min(WINDOWS[i], count);
        const series = (k: number) => v[slot(count - n + k)];
        if (m.fit(series, n)) m.forecast(at, cur[i]);
      });
      if (models[MAIN].ok) {
        haveCur = true;
        const issued = count - 1;
        const ti = issued % trajs.length;
        trajs[ti].set(cur[MAIN]);
        trajAt[ti] = issued;
        for (let h = 0; h < HN; h++) {
          const f = issued + 1 + h;
          const s = slot(f);
          if (predFor[s] !== f) {
            predFor[s] = f;
            pred[s] = cur[MAIN][h];
          }
        }
      }
      fitMs = performance.now() - t0;
    }
  }

  let sub = 0;
  let hover: { x: number; y: number } | null = null;

  function drawButterfly() {
    if (Wp >= W || tn < 2) return;
    const c = ctx!;
    const x0 = Wp + 8;
    const w = W - x0 - 8;
    const h = H - 16;
    const bx = (x: number) => x0 + w / 2 + (x / 21) * (w / 2);
    const by = (z: number) => 8 + h - (z / 50) * h;
    c.strokeStyle = colors.raster;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(Math.round(Wp) + 0.5, 0);
    c.lineTo(Math.round(Wp) + 0.5, H);
    c.stroke();
    // Schweif in vier Stufen, hinten blass
    c.lineWidth = 0.9;
    c.lineJoin = 'round';
    const chunks = 4;
    for (let q = 0; q < chunks; q++) {
      const a = Math.floor((tn * q) / chunks);
      const b = Math.floor((tn * (q + 1)) / chunks);
      c.strokeStyle = colors.graphit;
      c.globalAlpha = 0.12 + (0.5 * (q + 1)) / chunks;
      c.beginPath();
      for (let i = a; i <= Math.min(b, tn - 1); i++) {
        const idx = (th - tn + i + TRAIL) % TRAIL;
        const px = bx(tx[idx]);
        const py = by(tz[idx]);
        if (i === a) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    const last = (th - 1 + TRAIL) % TRAIL;
    c.fillStyle = missNow ? colors.signal : colors.graphit;
    c.beginPath();
    c.arc(bx(tx[last]), by(tz[last]), 3.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = colors.blei;
    c.textAlign = 'left';
    c.fillText('Zustand x · z', x0 + 4, 14);
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';
    const n = Math.min(count, Math.floor(seconds * RATE));
    const shift = sub * pxPerSample;
    const xAt = (k: number) => xNow() - k * pxPerSample - shift;

    c.strokeStyle = colors.raster;
    c.lineWidth = 1;
    c.beginPath();
    const secPx = RATE * pxPerSample;
    const phase = ((count % RATE) + sub) * pxPerSample;
    for (let x = xNow() - phase; x > 0; x -= secPx) {
      c.moveTo(Math.round(x) + 0.5, H - 5);
      c.lineTo(Math.round(x) + 0.5, H);
    }
    c.stroke();
    const xn = Math.round(xNow()) + 0.5;
    c.beginPath();
    c.moveTo(xn, 0);
    c.lineTo(xn, H);
    c.stroke();
    c.fillStyle = colors.blei;
    c.textAlign = 'left';
    c.fillText('jetzt', xn + 6, 14);
    c.fillText('+0,5 s', xn + 6, 30);

    if (n >= 2) {
      c.fillStyle = colors.signal;
      c.globalAlpha = 0.22;
      for (let k = n - 1; k >= 1; k--) {
        const a = count - 1 - k;
        const sa = slot(a);
        const sb = slot(a + 1);
        if (predFor[sa] !== a || predFor[sb] !== a + 1) continue;
        if (Math.abs(v[sa] - pred[sa]) <= TOL && Math.abs(v[sb] - pred[sb]) <= TOL) continue;
        c.beginPath();
        c.moveTo(xAt(k), yOf(v[sa]));
        c.lineTo(xAt(k - 1), yOf(v[sb]));
        c.lineTo(xAt(k - 1), yOf(pred[sb]));
        c.lineTo(xAt(k), yOf(pred[sa]));
        c.closePath();
        c.fill();
      }
      c.globalAlpha = 1;
      c.strokeStyle = colors.blei;
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      c.beginPath();
      let pen = false;
      for (let k = n - 1; k >= 0; k--) {
        const a = count - 1 - k;
        const s = slot(a);
        if (predFor[s] !== a) {
          pen = false;
          continue;
        }
        if (pen) c.lineTo(xAt(k), yOf(pred[s]));
        else c.moveTo(xAt(k), yOf(pred[s]));
        pen = true;
      }
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = colors.graphit;
      c.lineWidth = 1.7;
      c.lineJoin = 'round';
      c.beginPath();
      for (let k = n - 1; k >= 0; k--) {
        if (k === n - 1) c.moveTo(xAt(k), yOf(at(k)));
        else c.lineTo(xAt(k), yOf(at(k)));
      }
      c.stroke();
      if (haveCur) {
        const x0 = xAt(0);
        c.beginPath();
        c.moveTo(x0, yOf(at(0)));
        for (let h = 0; h < HN; h++) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[MAIN][h] + 2 * errH[h]));
        for (let h = HN - 1; h >= 0; h--) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[MAIN][h] - 2 * errH[h]));
        c.closePath();
        c.fillStyle = colors.band;
        c.fill();
        // Fächer der fünf Modelle
        c.setLineDash([4, 3]);
        models.forEach((m, i) => {
          if (!m.ok) return;
          const main = i === MAIN;
          c.strokeStyle = main ? colors.graphit : colors.blei;
          c.lineWidth = main ? 1.3 : 0.9;
          c.globalAlpha = main ? 1 : 0.6;
          c.beginPath();
          c.moveTo(x0, yOf(at(0)));
          for (let h = 0; h < HN; h++) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[i][h]));
          c.stroke();
        });
        c.globalAlpha = 1;
        c.setLineDash([]);
      }
      c.fillStyle = missNow ? colors.signal : colors.graphit;
      c.beginPath();
      c.arc(xAt(0), yOf(at(0)), 3, 0, Math.PI * 2);
      c.fill();

      if (hover && hover.x < xNow()) {
        const k = Math.round((xNow() - shift - hover.x) / pxPerSample);
        if (k >= 0 && k < n) {
          const x = xAt(k);
          const a = count - 1 - k;
          const s = slot(a);
          c.strokeStyle = colors.blei;
          c.globalAlpha = 0.6;
          c.beginPath();
          c.moveTo(Math.round(x) + 0.5, 0);
          c.lineTo(Math.round(x) + 0.5, H - 8);
          c.stroke();
          c.globalAlpha = 1;
          const left = x > Wp - 150;
          c.textAlign = left ? 'right' : 'left';
          const dx = left ? -8 : 8;
          c.fillStyle = colors.blei;
          c.fillText(`−${(k * DT).toFixed(1)} s`, x + dx, H - 18);
          c.fillStyle = colors.graphit;
          c.fillText(`ist ${fmt(v[s])}`, x + dx, 32);
          if (predFor[s] === a) {
            c.fillStyle = colors.blei;
            c.fillText(`vorhergesagt ${fmt(pred[s])}`, x + dx, 48);
          }
        }
      }
    }
    drawButterfly();
  }

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    set(['0,5 s', '±' + errH[HN - 1].toFixed(2), String(misses), fitMs.toFixed(1) + ' ms']);
  }

  resize();
  for (let k = 0; k < RATE * 12; k++) tick();
  if (!live) {
    for (let k = 0; k < seconds * RATE; k++) tick();
    draw();
    updateReadout(0, true);
    const stopStill = stillImage(canvas, resize, draw);
    return () => {
      stopStill();
      ac.abort();
    };
  }

  let acc = 0;
  const stopLoop = runLoop(
    canvas,
    {
      frame(dt, now) {
        acc += dt;
        while (acc >= DT) {
          tick();
          acc -= DT;
        }
        sub = acc / DT;
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
  canvas.addEventListener(
    'pointermove',
    (ev) => {
      const p = local(ev);
      hover = p;
      if (ev.pointerType === 'mouse' || ev.buttons > 0) {
        target = p.x >= xNow() - 40 && p.x < Wp ? Math.max(-1.2, Math.min(1.2, vOf(p.y))) : null;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (ev) => {
      const p = local(ev);
      impulse += vOf(p.y) > at(0) ? 1.6 : -1.6;
      if (ev.pointerType !== 'mouse') hover = p;
    },
    { signal },
  );
  const release = () => (target = null);
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener(
    'pointerleave',
    () => {
      target = null;
      hover = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        impulse += 1.6;
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        impulse -= 1.6;
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
