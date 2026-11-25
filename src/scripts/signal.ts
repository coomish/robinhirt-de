/**
 * Das Signal. Ein synthetischer Messwert wie von einem Sensor im laufenden
 * Betrieb: langsame Drift, Rauschen, gelegentlich ein Sprung oder eine Spitze.
 * Eine einfache Erkennung läuft mit: gleitender Mittelwert und gleitende
 * Standardabweichung über ein Fenster, Toleranzband = Mittel ± K·σ. Werte
 * außerhalb werden im selben Moment markiert. Alles lokal, keine Daten.
 */

const RATE = 50; // Abtastrate in Hz, unabhängig von der Bildrate
const DT = 1 / RATE;
const WINDOW = 120; // Fenster der Erkennung in Abtastwerten (2,4 s)
const K = 3.5; // Breite des Toleranzbands in σ; bei Gauß-Rauschen selten ein Fehlalarm
const MIN_SIGMA = 0.05; // Untergrenze, sonst wird das Band bei Ruhe zu eng
const MAX_SECONDS = 20; // längster sichtbarer Zeitraum
const CAP = MAX_SECONDS * RATE + 4;
const RANGE = 1.35; // Wertebereich, der die Höhe ausfüllt

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

class Generator {
  t = 0;
  private drift = 0;
  private step = 0;
  private burst = 0;
  private impulse = 0;
  private disturb = 0;
  /** Zielwert unter dem Zeiger, null wenn kein Zeiger auf der Fläche liegt */
  target: number | null = null;

  constructor(private rng: Rng) {}

  kick(amount: number) {
    this.impulse += amount;
  }

  next(): number {
    const r = this.rng;
    this.t += DT;
    this.drift = this.drift * 0.995 + gauss(r) * 0.006;
    this.step *= 0.994;
    this.impulse *= 0.82;

    let spike = 0;
    if (r() < 1 / (RATE * 9)) {
      const kind = r();
      const sign = r() < 0.5 ? -1 : 1;
      if (kind < 0.45) spike = sign * (0.5 + r() * 0.6);
      else if (kind < 0.8) this.step += sign * (0.3 + r() * 0.3);
      else this.burst = Math.round(RATE * 1.2);
    }
    const sigma = 0.045 * (this.burst > 0 ? 3.2 : 1);
    if (this.burst > 0) this.burst--;

    const base =
      0.3 * Math.sin(2 * Math.PI * 0.07 * this.t) +
      0.15 * Math.sin(2 * Math.PI * 0.023 * this.t + 1) +
      this.drift +
      this.step +
      this.impulse +
      spike +
      gauss(r) * sigma;

    if (this.target !== null) {
      this.disturb += (this.target - base - this.disturb) * 0.3;
    } else {
      this.disturb *= 0.9;
    }
    return base + this.disturb;
  }
}

class Detector {
  private buf = new Float64Array(WINDOW);
  private n = 0;
  private i = 0;
  private sum = 0;
  private sum2 = 0;
  mean = 0;
  sigma = MIN_SIGMA;

  /** Prüft x gegen die bisherigen Werte, nimmt x dann ins Fenster auf. */
  check(x: number): boolean {
    let out = false;
    if (this.n >= 20) {
      this.mean = this.sum / this.n;
      const v = Math.max(0, this.sum2 / this.n - this.mean * this.mean);
      this.sigma = Math.max(Math.sqrt(v), MIN_SIGMA);
      out = Math.abs(x - this.mean) > K * this.sigma;
    } else if (this.n > 0) {
      this.mean = this.sum / this.n;
    }
    if (this.n === WINDOW) {
      const old = this.buf[this.i];
      this.sum -= old;
      this.sum2 -= old * old;
    } else {
      this.n++;
    }
    this.buf[this.i] = x;
    this.sum += x;
    this.sum2 += x * x;
    this.i = (this.i + 1) % WINDOW;
    return out;
  }
}

/** Ringpuffer der sichtbaren Werte */
class Trace {
  v = new Float32Array(CAP);
  lo = new Float32Array(CAP);
  hi = new Float32Array(CAP);
  out = new Uint8Array(CAP);
  first = new Uint8Array(CAP);
  head = 0;
  count = 0;
  events = 0;
  last = 0;
  private calm = 1e9; // Werte seit der letzten Abweichung

  push(x: number, mean: number, sigma: number, out: boolean) {
    const i = this.head;
    this.v[i] = x;
    this.lo[i] = mean - K * sigma;
    this.hi[i] = mean + K * sigma;
    this.out[i] = out ? 1 : 0;
    const first = out && this.calm >= 30;
    this.first[i] = first ? 1 : 0;
    if (first) this.events++;
    this.calm = out ? 0 : this.calm + 1;
    this.last = x;
    this.head = (i + 1) % CAP;
    if (this.count < CAP) this.count++;
  }

  /** Index des k-t-letzten Werts (k = 0 ist der neueste) */
  at(k: number): number {
    return (this.head - 1 - k + CAP) % CAP;
  }
}

interface Colors {
  graphit: string;
  blei: string;
  raster: string;
  bernstein: string;
  band: string;
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
  };
}

export interface Readout {
  value?: HTMLElement | null;
  mean?: HTMLElement | null;
  band?: HTMLElement | null;
  events?: HTMLElement | null;
}

const fmt = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);

export function mountSignal(canvas: HTMLCanvasElement, readout: Readout = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;

  const gen = new Generator(live ? Math.random : mulberry32(2018));
  const det = new Detector();
  const trace = new Trace();
  let colors = readColors(canvas);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let seconds = 10;
  let pxPerSample = 2;
  const padY = 18;
  const xNow = () => W - 28;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    seconds = Math.min(MAX_SECONDS, Math.max(6, W / 60));
    pxPerSample = (xNow() - 8) / (seconds * RATE);
    if (live) while (trace.count < seconds * RATE * 0.9) tick();
  }

  const yOf = (v: number) => H / 2 - (v / RANGE) * (H / 2 - padY);
  const vOf = (y: number) => ((H / 2 - y) / (H / 2 - padY)) * RANGE;

  function tick() {
    const x = gen.next();
    const out = det.check(x);
    trace.push(x, det.mean, det.sigma, out);
  }

  let revealStart = 0;
  let sub = 0; // Bruchteil eines Abtastschritts, für weiches Schieben

  function draw(now: number) {
    const c = ctx!;
    c.clearRect(0, 0, W, H);

    let reveal = 1;
    if (live && revealStart) {
      const p = Math.min(1, (now - revealStart) / 1100);
      reveal = 1 - Math.pow(1 - p, 3);
      if (p >= 1) revealStart = 0;
    }
    const xLimit = reveal * W;

    const n = Math.min(trace.count, Math.floor(seconds * RATE));
    const shift = sub * pxPerSample;
    const xAt = (k: number) => xNow() - k * pxPerSample - shift;

    // Zeitachse: ein Strich pro Sekunde, läuft mit
    c.strokeStyle = colors.raster;
    c.lineWidth = 1;
    c.beginPath();
    const secPx = RATE * pxPerSample;
    const phase = ((gen.t % 1) * RATE + sub) * pxPerSample;
    for (let x = xNow() - phase; x > 0; x -= secPx) {
      c.moveTo(Math.round(x) + 0.5, H - 6);
      c.lineTo(Math.round(x) + 0.5, H);
    }
    c.stroke();

    if (n < 2) return;

    // Toleranzband
    c.beginPath();
    for (let k = n - 1; k >= 0; k--) {
      const i = trace.at(k);
      const x = xAt(k);
      if (x > xLimit) continue;
      c.lineTo(x, yOf(trace.hi[i]));
    }
    for (let k = 0; k < n; k++) {
      const i = trace.at(k);
      const x = xAt(k);
      if (x > xLimit) continue;
      c.lineTo(x, yOf(trace.lo[i]));
    }
    c.closePath();
    c.fillStyle = colors.band;
    c.fill();

    // Spur, im Band in Graphit, außerhalb in Bernstein
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const pass of [0, 1]) {
      c.beginPath();
      let pen = false;
      for (let k = n - 1; k >= 0; k--) {
        const i = trace.at(k);
        const x = xAt(k);
        const y = yOf(trace.v[i]);
        if (x > xLimit) break;
        const on = pass === 1 ? trace.out[i] === 1 : true;
        if (!on) {
          pen = false;
          continue;
        }
        if (pen) c.lineTo(x, y);
        else c.moveTo(x, y);
        pen = true;
      }
      c.strokeStyle = pass === 1 ? colors.bernstein : colors.graphit;
      c.lineWidth = pass === 1 ? 2.25 : 1.5;
      c.stroke();
    }

    // Marke am Beginn jeder Abweichung
    c.fillStyle = colors.bernstein;
    for (let k = n - 1; k >= 0; k--) {
      const i = trace.at(k);
      if (!trace.first[i]) continue;
      const x = xAt(k);
      if (x > xLimit) break;
      c.beginPath();
      c.arc(x, yOf(trace.v[i]), 3.2, 0, Math.PI * 2);
      c.fill();
    }

    // Schreibkopf
    if (reveal >= 1 || !live) {
      const i0 = trace.at(0);
      c.fillStyle = trace.out[i0] ? colors.bernstein : colors.graphit;
      c.beginPath();
      c.arc(xAt(0), yOf(trace.v[i0]), 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- Anzeige ---------------------------------------------------------
  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 120) return;
    lastReadout = now;
    if (readout.value) readout.value.textContent = fmt(trace.last);
    if (readout.mean) readout.mean.textContent = fmt(det.mean);
    if (readout.band) readout.band.textContent = '±' + (K * det.sigma).toFixed(2);
    if (readout.events) readout.events.textContent = String(trace.events);
  }

  // ---- Standbild bei reduzierter Bewegung -------------------------------
  resize();
  if (!live) {
    for (let k = 0; k < seconds * RATE; k++) tick();
    draw(0);
    updateReadout(0, true);
    const ro = new ResizeObserver(() => {
      resize();
      draw(0);
    });
    ro.observe(canvas);
    return;
  }

  // ---- Laufender Betrieb -------------------------------------------------
  let acc = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let running = false;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= DT) {
      tick();
      acc -= DT;
    }
    sub = acc / DT;
    draw(now);
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

  revealStart = performance.now();
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
      draw(performance.now());
      updateReadout(performance.now(), true);
    }
  }).observe(canvas);

  // Farbschema kann wechseln (Schalter oder System)
  const recolor = () => {
    colors = readColors(canvas);
    if (!running) draw(performance.now());
  };
  new MutationObserver(recolor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  reduced.addEventListener('change', () => {
    if (reduced.matches) stop();
    else start();
  });

  // ---- Stören: Zeiger, Finger, Tastatur ---------------------------------
  const setTarget = (ev: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const v = vOf(ev.clientY - rect.top);
    gen.target = Math.max(-RANGE, Math.min(RANGE, v));
  };
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse' || ev.buttons > 0) setTarget(ev);
  });
  canvas.addEventListener('pointerdown', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const v = vOf(ev.clientY - rect.top);
    gen.kick(v > trace.last ? 0.7 : -0.7);
    if (ev.pointerType !== 'mouse') setTarget(ev);
  });
  const release = () => (gen.target = null);
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      gen.kick(0.8);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      gen.kick(-0.8);
    }
  });
}
