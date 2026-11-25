/** Gemeinsames für die Motive im Kopf: Zufall, Farben, Anzeige, Schleife */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Colors {
  graphit: string;
  blei: string;
  raster: string;
  bernstein: string;
  band: string;
  papier: string;
}

export function readColors(el: HTMLElement): Colors {
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

export const MONO = '500 11px "JetBrains Mono", ui-monospace, monospace';
export const fmt = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);

export interface UI {
  werte?: HTMLElement | null;
  hinweis?: HTMLElement | null;
}

/** Baut die Wertezeile aus Beschriftungen und liefert einen Setter für die Werte */
export function readout(ui: UI, labels: string[]): (values: string[]) => void {
  const bs: HTMLElement[] = [];
  if (ui.werte) {
    ui.werte.replaceChildren(
      ...labels.map((l) => {
        const s = document.createElement('span');
        s.append(l + ' ');
        const b = document.createElement('b');
        b.textContent = '–';
        s.append(b);
        bs.push(b);
        return s;
      }),
    );
  }
  return (values) =>
    values.forEach((v, i) => {
      const b = bs[i];
      if (b && b.textContent !== v) b.textContent = v;
    });
}

export function hint(ui: UI, text: string) {
  if (ui.hinweis) ui.hinweis.textContent = text;
}

export interface Loop {
  /** Rechnet weiter; dt in Sekunden, now in ms */
  frame(dt: number, now: number): void;
  draw(now: number): void;
  resize(): void;
  recolor(): void;
}

/** Schleife mit Pause außerhalb des Sichtfelds, bei verstecktem Tab und reduzierter Bewegung */
export function runLoop(canvas: HTMLCanvasElement, loop: Loop, reduced: MediaQueryList) {
  let last = 0;
  let raf = 0;
  let visible = true;
  let running = false;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    loop.frame(dt, now);
    loop.draw(now);
  }
  function start() {
    if (running || !visible || document.hidden || reduced.matches) return;
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
    loop.resize();
    if (!running) loop.draw(performance.now());
  }).observe(canvas);
  const recolor = () => {
    loop.recolor();
    if (!running) loop.draw(performance.now());
  };
  new MutationObserver(recolor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  reduced.addEventListener('change', () => (reduced.matches ? stop() : start()));
  if (document.fonts?.load) document.fonts.load(MONO).catch(() => undefined);
}

export function setupCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width));
  const H = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}
