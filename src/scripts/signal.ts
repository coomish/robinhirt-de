/**
 * Das Signal. Drei synthetische Kanäle wie von Sensoren an einer Maschine:
 * Vibration, Temperatur, Strom. Jeder hat Rauschen, Drift und gelegentlich
 * einen Sprung oder eine Spitze; die Kanäle sind gekoppelt (Strom erwärmt mit
 * Verzögerung, Vibration schlägt auf den Strom durch). Pro Kanal läuft eine
 * einfache Erkennung mit: gleitender Mittelwert und Standardabweichung über ein
 * Fenster, Toleranzband = Mittel ± K·σ. Werte außerhalb werden im selben Moment
 * markiert, Ereignisse landen im Protokoll. Alles lokal im Browser, keine Daten.
 */

const RATE = 50; // Abtastrate in Hz, unabhängig von der Bildrate
const DT = 1 / RATE;
const WINDOW = 120; // Fenster der Erkennung in Abtastwerten (2,4 s)
const K = 3.5; // Breite des Toleranzbands in σ
const MAX_SECONDS = 20; // längster sichtbarer Zeitraum
const CAP = MAX_SECONDS * RATE + 4;
const CALM = 30; // ruhige Werte, bis ein Ereignis als beendet gilt
const BUS = 120; // Länge der Verzögerungsleitung für die Kopplung

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

interface Spec {
  name: string;
  noise: number; // σ des Grundrauschens
  drift: number; // Schrittweite des Random Walk
  slow: number; // Amplitude der langsamen Welle
  period: number; // Periode der langsamen Welle in s
  rate: number; // Ereignisse pro Sekunde
  spike: number; // Anteil Spitzen, Rest Sprünge und Streuung
  step: number;
  minSigma: number;
  range: number; // Wertebereich, der die Kanalhöhe füllt
}

const SPECS: Spec[] = [
  { name: 'Vibration', noise: 0.07, drift: 0.003, slow: 0.12, period: 9, rate: 1 / 9, spike: 0.6, step: 0.85, minSigma: 0.07, range: 0.95 },
  { name: 'Temperatur', noise: 0.012, drift: 0.004, slow: 0.35, period: 40, rate: 1 / 18, spike: 0.1, step: 0.8, minSigma: 0.03, range: 0.9 },
  { name: 'Strom', noise: 0.035, drift: 0.003, slow: 0.2, period: 15, rate: 1 / 11, spike: 0.35, step: 0.85, minSigma: 0.05, range: 1.0 },
];

/** Kopplung: [von][nach] = { gain, lag in Abtastwerten, smooth } */
const COUPLING: { from: number; to: number; gain: number; lag: number; smooth: number }[] = [
  { from: 2, to: 1, gain: 0.55, lag: 60, smooth: 0.04 }, // Strom erwärmt, träge
  { from: 0, to: 2, gain: 0.3, lag: 4, smooth: 0.5 }, // Vibration schlägt auf den Strom durch
  { from: 2, to: 0, gain: 0.12, lag: 10, smooth: 0.6 }, // Laständerung rüttelt leicht
];

class Generator {
  private phase: number;
  private drift = 0;
  private step = 0;
  private burst = 0;
  private impulse = 0;
  private disturb = 0;
  /** Zielwert unter dem Zeiger, null wenn kein Zeiger auf dem Kanal liegt */
  target: number | null = null;

  constructor(
    readonly spec: Spec,
    private rng: Rng,
  ) {
    this.phase = rng() * 7;
  }

  kick(amount: number) {
    this.impulse += amount;
  }

  next(t: number, coupled: number): number {
    const r = this.rng;
    const s = this.spec;
    this.drift = this.drift * 0.995 + gauss(r) * s.drift;
    this.step *= 0.994;
    this.impulse *= 0.82;

    let spike = 0;
    if (r() < s.rate / RATE) {
      const kind = r();
      const sign = r() < 0.5 ? -1 : 1;
      if (kind < s.spike) spike = sign * (0.5 + r() * 0.6);
      else if (kind < s.step) this.step += sign * (0.3 + r() * 0.35);
      else this.burst = Math.round(RATE * 1.2);
    }
    const sigma = s.noise * (this.burst > 0 ? 3.2 : 1);
    if (this.burst > 0) this.burst--;

    const base =
      s.slow * Math.sin((2 * Math.PI * t) / s.period + this.phase) +
      (s.slow / 2) * Math.sin((2 * Math.PI * t) / (s.period * 2.7) + 1) +
      this.drift +
      this.step +
      this.impulse +
      spike +
      coupled +
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
  sigma: number;

  constructor(private minSigma: number) {
    this.sigma = minSigma;
  }

  /** Prüft x gegen die bisherigen Werte, nimmt x dann ins Fenster auf. */
  check(x: number): boolean {
    let out = false;
    if (this.n >= 20) {
      this.mean = this.sum / this.n;
      const v = Math.max(0, this.sum2 / this.n - this.mean * this.mean);
      this.sigma = Math.max(Math.sqrt(v), this.minSigma);
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

  get ready() {
    return this.n >= 20;
  }
}

export interface Ereignis {
  kanal: string;
  start: number; // Sekunden seit Beginn
  dauer: number | null; // null solange offen
  art: 'Spitze' | 'Sprung' | 'Streuung' | 'Eingriff' | 'offen';
  staerke: number; // größter Abstand in σ
}

interface Offen {
  start: number;
  calm: number;
  maxDev: number;
  meanStart: number;
  sigmaStart: number;
  touched: boolean;
  eintrag: Ereignis;
}

/** Ein Kanal: Erzeugung, Erkennung, Ringpuffer der sichtbaren Werte */
class Channel {
  gen: Generator;
  det: Detector;
  v = new Float32Array(CAP);
  lo = new Float32Array(CAP);
  hi = new Float32Array(CAP);
  out = new Uint8Array(CAP);
  first = new Uint8Array(CAP);
  head = 0;
  count = 0;
  events = 0;
  last = 0;
  /** Abweichung vom Mittel, verzögert abrufbar für die Kopplung */
  bus = new Float32Array(BUS);
  private calm = 1e9;
  private offen: Offen | null = null;
  coupledIn = 0;

  constructor(
    readonly spec: Spec,
    rng: Rng,
    private onEvent: (e: Ereignis, neu: boolean) => void,
  ) {
    this.gen = new Generator(spec, rng);
    this.det = new Detector(spec.minSigma);
  }

  /** Abweichung vor `lag` Abtastwerten */
  delayed(lag: number): number {
    return this.bus[(this.head - 1 - lag + BUS * 4) % BUS];
  }

  tick(t: number, coupled: number) {
    const x = this.gen.next(t, coupled);
    const det = this.det;
    const meanBefore = det.mean;
    const sigmaBefore = det.sigma;
    const out = det.check(x);
    const dev = det.ready ? x - meanBefore : 0;

    const i = this.head;
    this.v[i] = x;
    this.lo[i] = det.mean - K * det.sigma;
    this.hi[i] = det.mean + K * det.sigma;
    this.out[i] = out ? 1 : 0;
    this.bus[i % BUS] = dev;
    this.last = x;

    // Ereignisse: neu nach CALM ruhigen Werten, Ende nach CALM ruhigen Werten
    let first = false;
    if (out) {
      if (!this.offen && this.calm >= CALM) {
        first = true;
        this.events++;
        const eintrag: Ereignis = {
          kanal: this.spec.name,
          start: t,
          dauer: null,
          art: 'offen',
          staerke: 0,
        };
        this.offen = {
          start: t,
          calm: 0,
          maxDev: 0,
          meanStart: meanBefore,
          sigmaStart: sigmaBefore,
          touched: this.gen.target !== null,
          eintrag,
        };
        this.onEvent(eintrag, true);
      }
      this.calm = 0;
    } else {
      this.calm++;
    }
    if (this.offen) {
      const o = this.offen;
      o.maxDev = Math.max(o.maxDev, Math.abs(dev) / Math.max(o.sigmaStart, 1e-6));
      if (this.gen.target !== null) o.touched = true;
      if (!out) o.calm++;
      else o.calm = 0;
      if (o.calm >= CALM) {
        const e = o.eintrag;
        e.dauer = Math.max(DT, t - o.start - CALM * DT);
        e.staerke = o.maxDev;
        const shift = Math.abs(det.mean - o.meanStart) / Math.max(o.sigmaStart, 1e-6);
        e.art = o.touched ? 'Eingriff' : e.dauer <= 0.2 ? 'Spitze' : shift > 2 ? 'Sprung' : 'Streuung';
        this.offen = null;
        this.onEvent(e, false);
      }
    }
    this.first[i] = first ? 1 : 0;
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
  values?: (HTMLElement | null)[];
  events?: HTMLElement | null;
  log?: HTMLElement | null;
}

const fmt = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};
const MONO = '500 11px "JetBrains Mono", ui-monospace, monospace';

export function mountSignal(canvas: HTMLCanvasElement, readout: Readout = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng = live ? Math.random : mulberry32(2018);

  // ---- Protokoll ----------------------------------------------------------
  const log: Ereignis[] = [];
  let logDirty = false;
  const onEvent = (e: Ereignis, neu: boolean) => {
    if (neu) {
      log.unshift(e);
      if (log.length > 5) log.length = 5;
    }
    logDirty = true;
  };
  const chans = SPECS.map((s) => new Channel(s, rng, onEvent));
  const N = chans.length;
  let colors = readColors(canvas);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let seconds = 10;
  let pxPerSample = 2;
  let margin = 64;
  let t = 0; // Sekunden seit Beginn
  const xNow = () => W - margin;
  const laneH = () => H / N;
  const padY = 14;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    margin = W > 640 ? 64 : 52;
    seconds = Math.min(MAX_SECONDS, Math.max(6, (W - margin) / 60));
    pxPerSample = (xNow() - 8) / (seconds * RATE);
    if (live) while (chans[0].count < seconds * RATE * 0.9) tick();
  }

  const yOf = (c: number, v: number) => {
    const h = laneH();
    const y = c * h + h / 2 - (v / chans[c].spec.range) * (h / 2 - padY);
    return Math.max(c * h + 4, Math.min((c + 1) * h - 4, y));
  };
  const vOf = (c: number, y: number) => {
    const h = laneH();
    return ((c * h + h / 2 - y) / (h / 2 - padY)) * chans[c].spec.range;
  };

  function tick() {
    t += DT;
    const inputs = new Array<number>(N).fill(0);
    for (const k of COUPLING) {
      const target = k.gain * chans[k.from].delayed(k.lag);
      const ch = chans[k.to];
      ch.coupledIn += (target - ch.coupledIn) * k.smooth;
      inputs[k.to] += ch.coupledIn;
    }
    for (let c = 0; c < N; c++) chans[c].tick(t, inputs[c]);
  }

  // ---- Zeichnen -----------------------------------------------------------
  let revealStart = 0;
  let sub = 0; // Bruchteil eines Abtastschritts, für weiches Schieben
  let hover: { x: number; y: number } | null = null;

  function draw(now: number) {
    const c2 = ctx!;
    c2.clearRect(0, 0, W, H);
    c2.font = MONO;
    c2.textBaseline = 'middle';

    const n = Math.min(chans[0].count, Math.floor(seconds * RATE));
    const shift = sub * pxPerSample;
    const xAt = (k: number) => xNow() - k * pxPerSample - shift;

    // Trennlinien und Kanalnamen
    c2.strokeStyle = colors.raster;
    c2.lineWidth = 1;
    c2.fillStyle = colors.blei;
    c2.textAlign = 'left';
    for (let c = 0; c < N; c++) {
      const y = Math.round(c * laneH()) + 0.5;
      if (c > 0) {
        c2.beginPath();
        c2.moveTo(0, y);
        c2.lineTo(W, y);
        c2.stroke();
      }
      c2.fillText(chans[c].spec.name, 16, y + 13);
    }

    // Zeitachse: ein Strich pro Sekunde, Beschriftung alle fünf
    const secPx = RATE * pxPerSample;
    const phase = ((t % 1) * RATE + sub) * pxPerSample;
    const whole = Math.floor(t);
    c2.beginPath();
    let s = 0;
    for (let x = xNow() - phase; x > 0; x -= secPx, s++) {
      const sec = whole - s;
      const major = sec % 5 === 0;
      c2.moveTo(Math.round(x) + 0.5, H - (major ? 9 : 5));
      c2.lineTo(Math.round(x) + 0.5, H);
      if (major && s > 0 && x > 40 && x < xNow() - 30) {
        c2.textAlign = 'center';
        c2.fillText(fmtT(sec).replace(/\.\d$/, ''), x, H - 17);
      }
    }
    c2.stroke();

    if (n < 2) return;

    for (let c = 0; c < N; c++) {
      const ch = chans[c];
      let reveal = 1;
      if (live && revealStart) {
        const p = Math.min(1, Math.max(0, (now - revealStart - c * 180) / 1100));
        reveal = 1 - Math.pow(1 - p, 3);
      }
      const xLimit = reveal * W;

      // Toleranzband
      c2.beginPath();
      for (let k = n - 1; k >= 0; k--) {
        const x = xAt(k);
        if (x > xLimit) continue;
        c2.lineTo(x, yOf(c, ch.hi[ch.at(k)]));
      }
      for (let k = 0; k < n; k++) {
        const x = xAt(k);
        if (x > xLimit) continue;
        c2.lineTo(x, yOf(c, ch.lo[ch.at(k)]));
      }
      c2.closePath();
      c2.fillStyle = colors.band;
      c2.fill();

      // Spur, im Band in Graphit, außerhalb in Bernstein
      c2.lineJoin = 'round';
      c2.lineCap = 'round';
      for (const pass of [0, 1]) {
        c2.beginPath();
        let pen = false;
        for (let k = n - 1; k >= 0; k--) {
          const i = ch.at(k);
          const x = xAt(k);
          if (x > xLimit) break;
          const on = pass === 1 ? ch.out[i] === 1 : true;
          if (!on) {
            pen = false;
            continue;
          }
          const y = yOf(c, ch.v[i]);
          if (pen) c2.lineTo(x, y);
          else c2.moveTo(x, y);
          pen = true;
        }
        c2.strokeStyle = pass === 1 ? colors.bernstein : colors.graphit;
        c2.lineWidth = pass === 1 ? 2.25 : 1.4;
        c2.stroke();
      }

      // Marke am Beginn jeder Abweichung
      c2.fillStyle = colors.bernstein;
      for (let k = n - 1; k >= 0; k--) {
        const i = ch.at(k);
        if (!ch.first[i]) continue;
        const x = xAt(k);
        if (x > xLimit) break;
        c2.beginPath();
        c2.arc(x, yOf(c, ch.v[i]), 3.2, 0, Math.PI * 2);
        c2.fill();
      }

      if (reveal < 1) continue;

      // Schreibkopf und Bandbreite am rechten Rand
      const i0 = ch.at(0);
      c2.fillStyle = ch.out[i0] ? colors.bernstein : colors.graphit;
      c2.beginPath();
      c2.arc(xAt(0), yOf(c, ch.v[i0]), 2.6, 0, Math.PI * 2);
      c2.fill();
      c2.fillStyle = colors.blei;
      c2.textAlign = 'left';
      const yMean = yOf(c, (ch.hi[i0] + ch.lo[i0]) / 2);
      c2.fillText(`±${((ch.hi[i0] - ch.lo[i0]) / 2).toFixed(2)}`, xNow() + 10, yMean);
    }

    // Messcursor unter dem Zeiger
    if (hover && !revealStart) {
      const k = Math.round((xNow() - shift - hover.x) / pxPerSample);
      if (k >= 0 && k < n) {
        const x = xAt(k);
        c2.strokeStyle = colors.blei;
        c2.globalAlpha = 0.6;
        c2.beginPath();
        c2.moveTo(Math.round(x) + 0.5, 0);
        c2.lineTo(Math.round(x) + 0.5, H - 20);
        c2.stroke();
        c2.globalAlpha = 1;
        const left = x > W - 110;
        c2.textAlign = left ? 'right' : 'left';
        const dx = left ? -8 : 8;
        c2.fillStyle = colors.blei;
        c2.fillText(`−${(k * DT).toFixed(1)} s`, x + dx, H - 30);
        for (let c = 0; c < N; c++) {
          const ch = chans[c];
          const i = ch.at(k);
          const y = yOf(c, ch.v[i]);
          c2.fillStyle = ch.out[i] ? colors.bernstein : colors.graphit;
          c2.beginPath();
          c2.arc(x, y, 3, 0, Math.PI * 2);
          c2.fill();
          c2.fillText(fmt(ch.v[i]), x + dx, y - 10);
        }
      }
    }
  }

  // ---- Anzeige ------------------------------------------------------------
  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 120) return;
    lastReadout = now;
    readout.values?.forEach((el, c) => {
      if (el) el.textContent = fmt(chans[c].last);
    });
    if (readout.events) readout.events.textContent = String(chans.reduce((a, c) => a + c.events, 0));
    if (readout.log && (logDirty || force)) {
      logDirty = false;
      readout.log.replaceChildren(
        ...log.map((e) => {
          const li = document.createElement('li');
          const art = e.art === 'offen' ? '…' : e.art;
          const dauer = e.dauer === null ? '' : e.dauer < 0.1 ? '<0.1 s' : `${e.dauer.toFixed(1)} s`;
          li.innerHTML = `<span>${fmtT(e.start)}</span><span>${e.kanal}</span><span>${art}</span><span>${dauer}</span><span>${e.staerke ? e.staerke.toFixed(1) + ' σ' : ''}</span>`;
          return li;
        }),
      );
    }
  }

  // ---- Standbild bei reduzierter Bewegung ----------------------------------
  resize();
  if (!live) {
    for (let k = 0; k < seconds * RATE; k++) tick();
    draw(0);
    updateReadout(0, true);
    new ResizeObserver(() => {
      resize();
      draw(0);
    }).observe(canvas);
    return;
  }

  // ---- Laufender Betrieb ---------------------------------------------------
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
    if (revealStart && now - revealStart > 1100 + N * 180) revealStart = 0;
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
  if (document.fonts?.load) document.fonts.load(MONO).catch(() => undefined);

  // ---- Stören und Messen: Zeiger, Finger, Tastatur -------------------------
  const laneOf = (y: number) => Math.min(N - 1, Math.max(0, Math.floor(y / laneH())));
  const local = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const setTarget = (p: { x: number; y: number }) => {
    const c = laneOf(p.y);
    chans.forEach((ch, i) => {
      if (i !== c) ch.gen.target = null;
    });
    const v = vOf(c, p.y);
    chans[c].gen.target = Math.max(-chans[c].spec.range, Math.min(chans[c].spec.range, v));
  };
  const release = () => {
    chans.forEach((ch) => (ch.gen.target = null));
    hover = null;
  };
  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    if (ev.pointerType === 'mouse') {
      hover = p;
      setTarget(p);
    } else if (ev.buttons > 0) {
      hover = p;
      setTarget(p);
    }
  });
  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev);
    const c = laneOf(p.y);
    chans[c].gen.kick(vOf(c, p.y) > chans[c].last ? 0.7 : -0.7);
    if (ev.pointerType !== 'mouse') {
      hover = p;
      setTarget(p);
    }
  });
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let keyLane = 0;
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === '1' || ev.key === '2' || ev.key === '3') {
      keyLane = Number(ev.key) - 1;
    } else if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      chans[keyLane].gen.kick(0.8);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      chans[keyLane].gen.kick(-0.8);
    } else if (ev.key === 'Tab') {
      return;
    } else {
      return;
    }
  });
}
