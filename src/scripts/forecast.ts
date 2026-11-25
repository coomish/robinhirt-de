/**
 * Vorhersage gegen Wirklichkeit. Ein chaotisches System (Lorenz, das Modell
 * hinter dem Schmetterlingseffekt) läuft als Spur. Ein autoregressives Modell
 * lernt laufend aus den letzten Sekunden und sagt die nächsten 0,5 s voraus.
 * Die Vorhersage läuft als Schatten vor der Spur her; wo die Wirklichkeit sie
 * verfehlt, wird die Lücke Bernstein. Der Fehler wächst mit dem Horizont, das
 * zeigt der Kegel vor dem Jetzt. Alles lokal im Browser.
 */
import { gauss, hint, mulberry32, readColors, readout, runLoop, setupCanvas, fmt, MONO, type Colors, type Rng, type UI } from './ui';

const RATE = 50;
const DT = 1 / RATE;
const HORIZON = 0.5; // Sekunden
const HN = Math.round(HORIZON * RATE);
const P = 16; // Ordnung des AR-Modells
const FITWIN = 300; // Abtastwerte zum Anpassen (6 s)
const FIT_EVERY = 5;
const MAX_SECONDS = 16;
const CAP = (MAX_SECONDS + HORIZON) * RATE + 8;
const TOL = 0.12; // Toleranz, ab der eine Abweichung markiert wird
const SCALE = 22; // Lorenz-x auf ±1

export const HINWEIS_VORHERSAGE =
  'Die Spur ist ein chaotisches System (Lorenz), die Mathematik hinter dem Schmetterlingseffekt. Ein autoregressives Modell lernt laufend aus den letzten sechs Sekunden und sagt die nächsten 0,5 s voraus. Wo die Wirklichkeit die Vorhersage verfehlt, wird die Lücke Bernstein; der Kegel zeigt den erwarteten Fehler je Horizont. Alles lokal im Browser. Maus oder Finger ziehen die Spur.';

class Lorenz {
  x = 1;
  y = 1;
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

/** Autoregression per kleinster Quadrate (Normalengleichungen, Cholesky) */
class AR {
  coef = new Float64Array(P + 1); // letzte Stelle: Achsenabschnitt
  ok = false;

  fit(series: (k: number) => number, n: number): boolean {
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
    for (let i = 0; i < M; i++) A[i * M + i] += 1e-3 * rows; // Ridge
    // Cholesky in A (unteres Dreieck)
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

  /** Sagt HN Schritte voraus; series(0) ist der neueste Wert, series(k) der k-t-letzte */
  forecast(series: (k: number) => number, out: Float32Array) {
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

export function mountForecast(canvas: HTMLCanvasElement, ui: UI = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const set = readout(ui, ['Horizont', 'Fehler am Horizont', 'Verfehlt', 'Rechenzeit']);
  hint(
    ui,
    live
      ? HINWEIS_VORHERSAGE
      : 'Standbild, da reduzierte Bewegung eingestellt ist: Ein chaotisches System (Lorenz) als Spur, davor die Vorhersage eines autoregressiven Modells; Bernstein, wo die Wirklichkeit sie verfehlte. Gerechnet lokal im Browser.',
  );
  canvas.setAttribute(
    'aria-label',
    'Ein chaotisches System läuft als Spur, ein Modell sagt die nächsten 0,5 Sekunden voraus; Abweichungen werden markiert',
  );

  const lor = new Lorenz(rng);
  const ar = new AR();
  let colors: Colors = readColors(canvas);

  // Ringpuffer der Wirklichkeit und der Vorhersage je Abtastwert
  const v = new Float32Array(CAP);
  const pred = new Float32Array(CAP);
  const predFor = new Int32Array(CAP).fill(-1); // absoluter Index, für den pred gilt
  let count = 0; // absolute Zahl der Abtastwerte
  const slot = (abs: number) => ((abs % CAP) + CAP) % CAP;
  const at = (k: number) => v[slot(count - 1 - k)]; // k-t-letzter Wert

  // Letzte Vorhersagen je Ausgabezeitpunkt, für den Fehler je Horizont
  const trajs: Float32Array[] = Array.from({ length: HN + FIT_EVERY + 2 }, () => new Float32Array(HN));
  const trajAt = new Int32Array(trajs.length).fill(-1);
  const errH = new Float32Array(HN).fill(0.08); // mittlerer Betrag des Fehlers je Horizont
  const cur = new Float32Array(HN);
  let haveCur = false;
  let misses = 0;
  let calm = 1e9;
  let fitMs = 0;
  let target: number | null = null;
  let impulse = 0;

  let W = 0;
  let H = 0;
  let seconds = 10;
  let pxPerSample = 2;
  const padY = 18;
  const xNow = () => W - 16 - HN * pxPerSample;
  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
    seconds = Math.min(MAX_SECONDS, Math.max(5, W / 80));
    pxPerSample = (W - 24) / (seconds * RATE + HN);
  }
  const yOf = (x: number) => H / 2 - x * (H / 2 - padY);
  const vOf = (y: number) => (H / 2 - y) / (H / 2 - padY);

  function tick() {
    // Eingriff: Zeiger zieht, Stoß schiebt
    if (target !== null) lor.x += (target * SCALE - lor.x) * 0.12;
    lor.x += impulse;
    impulse *= 0.8;
    for (let s = 0; s < 2; s++) lor.step(0.0025);
    const x = Math.max(-1.3, Math.min(1.3, lor.x / SCALE));
    const abs = count;
    v[slot(abs)] = x;
    count++;
    // Fehler je Horizont aus früheren Vorhersagen
    for (let h = 1; h <= HN; h++) {
      const issued = abs - h;
      const ti = ((issued % trajs.length) + trajs.length) % trajs.length;
      if (trajAt[ti] !== issued) continue;
      const e = Math.abs(x - trajs[ti][h - 1]);
      errH[h - 1] += (e - errH[h - 1]) * 0.03;
    }
    // Verfehlt? (gegen die Vorhersage, die für diesen Moment gilt)
    const p = predFor[slot(abs)] === abs ? pred[slot(abs)] : NaN;
    const miss = !Number.isNaN(p) && Math.abs(x - p) > TOL;
    if (miss && calm >= 25) misses++;
    calm = miss ? 0 : calm + 1;

    if (count % FIT_EVERY === 0 && count >= P + 40) {
      const t0 = performance.now();
      const n = Math.min(FITWIN, count);
      const series = (k: number) => v[slot(count - n + k)]; // k = 0 … n-1, aufsteigend
      if (ar.fit(series, n)) {
        ar.forecast(at, cur);
        haveCur = true;
        const issued = count - 1;
        const ti = issued % trajs.length;
        trajs[ti].set(cur);
        trajAt[ti] = issued;
        for (let h = 0; h < HN; h++) {
          const f = issued + 1 + h;
          const s = slot(f);
          if (predFor[s] !== f) {
            predFor[s] = f;
            pred[s] = cur[h];
          }
        }
      }
      fitMs = performance.now() - t0;
    }
  }

  let sub = 0;
  let hover: { x: number; y: number } | null = null;

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';
    const n = Math.min(count, Math.floor(seconds * RATE));
    const shift = sub * pxPerSample;
    const xAt = (k: number) => xNow() - k * pxPerSample - shift;

    // Zeitachse unten, ein Strich je Sekunde
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
    // Jetzt-Linie
    const xn = Math.round(xNow()) + 0.5;
    c.beginPath();
    c.moveTo(xn, 0);
    c.lineTo(xn, H);
    c.stroke();
    c.fillStyle = colors.blei;
    c.textAlign = 'left';
    c.fillText('jetzt', xn + 6, 14);
    c.fillText(`+${HORIZON.toFixed(1).replace('.', ',')} s`, xn + 6, 30);

    if (n < 2) return;

    // Lücken zwischen Vorhersage und Wirklichkeit
    c.fillStyle = colors.bernstein;
    c.globalAlpha = 0.22;
    for (let k = n - 1; k >= 1; k--) {
      const a = count - 1 - k;
      const sa = slot(a);
      const sb = slot(a + 1);
      if (predFor[sa] !== a || predFor[sb] !== a + 1) continue;
      const da = v[sa] - pred[sa];
      const db = v[sb] - pred[sb];
      if (Math.abs(da) <= TOL && Math.abs(db) <= TOL) continue;
      c.beginPath();
      c.moveTo(xAt(k), yOf(v[sa]));
      c.lineTo(xAt(k - 1), yOf(v[sb]));
      c.lineTo(xAt(k - 1), yOf(pred[sb]));
      c.lineTo(xAt(k), yOf(pred[sa]));
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;

    // Schatten: was vor 1,5 s für diesen Moment vorhergesagt wurde
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
      const x = xAt(k);
      const y = yOf(pred[s]);
      if (pen) c.lineTo(x, y);
      else c.moveTo(x, y);
      pen = true;
    }
    c.stroke();
    c.setLineDash([]);

    // Wirklichkeit
    c.strokeStyle = colors.graphit;
    c.lineWidth = 1.6;
    c.lineJoin = 'round';
    c.beginPath();
    for (let k = n - 1; k >= 0; k--) {
      const x = xAt(k);
      const y = yOf(at(k));
      if (k === n - 1) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();

    // Vorhersage ab jetzt mit Fehlerkegel
    if (haveCur) {
      const x0 = xAt(0);
      c.beginPath();
      c.moveTo(x0, yOf(at(0)));
      for (let h = 0; h < HN; h++) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[h] + 2 * errH[h]));
      for (let h = HN - 1; h >= 0; h--) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[h] - 2 * errH[h]));
      c.closePath();
      c.fillStyle = colors.band;
      c.fill();
      c.strokeStyle = colors.graphit;
      c.lineWidth = 1.2;
      c.setLineDash([4, 3]);
      c.beginPath();
      c.moveTo(x0, yOf(at(0)));
      for (let h = 0; h < HN; h++) c.lineTo(x0 + (h + 1) * pxPerSample, yOf(cur[h]));
      c.stroke();
      c.setLineDash([]);
    }
    // Schreibkopf
    c.fillStyle = colors.graphit;
    c.beginPath();
    c.arc(xAt(0), yOf(at(0)), 2.8, 0, Math.PI * 2);
    c.fill();

    // Messcursor in der Vergangenheit
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
        c.textAlign = x > W - 150 ? 'right' : 'left';
        const dx = x > W - 150 ? -8 : 8;
        c.fillStyle = colors.blei;
        c.fillText(`−${(k * DT).toFixed(1)} s`, x + dx, H - 18);
        c.fillStyle = colors.graphit;
        c.fillText(`ist ${fmt(v[s])}`, x + dx, 14 + 18);
        if (predFor[s] === a) {
          c.fillStyle = colors.blei;
          c.fillText(`vorhergesagt ${fmt(pred[s])}`, x + dx, 14 + 34);
        }
      }
    }
  }

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    set([`${HORIZON.toFixed(1).replace('.', ',')} s`, '±' + errH[HN - 1].toFixed(2), String(misses), fitMs.toFixed(1) + ' ms']);
  }

  resize();
  // Vorlauf, damit das Modell beim ersten Bild etwas gelernt hat
  for (let k = 0; k < RATE * 8; k++) tick();
  if (!live) {
    for (let k = 0; k < seconds * RATE; k++) tick();
    draw();
    updateReadout(0, true);
    new ResizeObserver(() => {
      resize();
      draw();
    }).observe(canvas);
    return;
  }

  let acc = 0;
  runLoop(
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
  );

  const local = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    hover = p;
    if (ev.pointerType === 'mouse' || ev.buttons > 0) {
      target = p.x >= xNow() - 40 ? Math.max(-1.2, Math.min(1.2, vOf(p.y))) : null;
    }
  });
  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev);
    impulse += vOf(p.y) > at(0) ? 1.6 : -1.6;
    if (ev.pointerType !== 'mouse') hover = p;
  });
  const release = () => {
    target = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    target = null;
    hover = null;
  });
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      impulse += 1.6;
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      impulse -= 1.6;
    }
  });
}
