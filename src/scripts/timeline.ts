/**
 * Die Achse im Werdegang: dieselbe Spur wie im Signal, hier ruhig. Sie wird
 * beim Scrollen gezogen; jeder Eintrag füllt sich, wenn die Spur ihn erreicht.
 */
export function mountTimeline(root: HTMLElement) {
  const svgEl = root.querySelector<SVGSVGElement>('svg.trace');
  const pathEl = svgEl?.querySelector<SVGPathElement>('path');
  const items = Array.from(root.querySelectorAll<HTMLElement>('li'));
  if (!svgEl || !pathEl) return;
  const svg: SVGSVGElement = svgEl;
  const path: SVGPathElement = pathEl;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let length = 0;
  let marks: number[] = [];

  function build() {
    const h = root.offsetHeight;
    const w = 24;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('height', String(h));
    // eine ruhige Spur: feine, feste Welle statt gerader Linie
    const parts: string[] = [`M ${w / 2} 0`];
    for (let y = 6; y <= h; y += 6) {
      const x = w / 2 + Math.sin(y / 23) * 1.6 + Math.sin(y / 7.3) * 0.7;
      parts.push(`L ${x.toFixed(2)} ${y}`);
    }
    parts.push(`L ${w / 2} ${h}`);
    path.setAttribute('d', parts.join(' '));
    length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    marks = items.map((li) => {
      const dot = li.querySelector<HTMLElement>('.year') ?? li;
      return dot.offsetTop - root.offsetTop + 10;
    });
    root.classList.add('is-ready');
  }

  function update() {
    const r = root.getBoundingClientRect();
    const line = window.innerHeight * 0.72;
    const p = Math.max(0, Math.min(1, (line - r.top) / r.height));
    path.style.strokeDashoffset = `${length * (1 - p)}`;
    const reach = p * r.height;
    items.forEach((li, i) => li.classList.toggle('is-passed', reach >= marks[i]));
  }

  build();
  if (reduced) {
    path.style.strokeDashoffset = '0';
    items.forEach((li) => li.classList.add('is-passed'));
    return;
  }
  update();
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => {
    build();
    update();
  }).observe(root);
}
