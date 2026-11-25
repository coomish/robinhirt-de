/**
 * Ordnung im Schwarm. Tausende Punkte folgen drei einfachen Regeln: Abstand
 * halten, Richtung angleichen, zusammenbleiben. Dazu ein leiser Wind und ein
 * Jäger: Angst springt von Nachbar zu Nachbar und läuft als Welle durch den
 * Schwarm, so entstehen die Formen einer Murmuration. Ein Clustering (k-means,
 * Zahl der Gruppen aus den Daten gewählt) findet die Gruppen und umreißt sie;
 * wer weit von seiner Gruppe entfernt ist, wird Türkis. Alles lokal.
 */
import { hint, mulberry32, readColors, readout, runLoop, setupCanvas, stillImage, MONO, type Colors, type Rng, type UI, type Unmount } from './ui';

const KMAX = 5;
const SEE = 34; // Sichtweite
const APART = 10; // Mindestabstand
const NEIGHBORS = 14; // so viele Nachbarn zählen (topologisch, wie bei Staren)
const OUT_Z = 2.8;
const MAX_N = 2400;

export const HINWEIS_SCHWARM =
  'Tausende Punkte, drei Regeln, kein Plan: Angst läuft als Welle durch den Schwarm, Gruppen entstehen von selbst, ein Clustering findet sie. Maus jagt.';

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mountSwarm(canvas: HTMLCanvasElement, ui: UI = {}): Unmount {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const ac = new AbortController();
  const signal = ac.signal;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const set = readout(ui, ['Individuen', 'Gruppen', 'Außenseiter', 'Rechenzeit']);
  hint(ui, (live ? HINWEIS_SCHWARM : 'Standbild bei reduzierter Bewegung: ' + HINWEIS_SCHWARM) + ' Synthetisch, gerechnet lokal im Browser.');
  canvas.setAttribute('aria-label', 'Ein Schwarm aus tausenden Punkten bewegt sich wie Stare; ein Clustering findet live die Gruppen und umreißt sie');

  let colors: Colors = readColors(canvas);
  let W = 0;
  let H = 0;
  let N = 1200;
  const px = new Float32Array(MAX_N);
  const py = new Float32Array(MAX_N);
  const vx = new Float32Array(MAX_N);
  const vy = new Float32Array(MAX_N);
  const fear = new Float32Array(MAX_N);
  const fearNext = new Float32Array(MAX_N);
  const label = new Int8Array(MAX_N);
  const outlier = new Uint8Array(MAX_N);
  let k = 1;
  const centers = new Float32Array(KMAX * 2);
  const members = new Int32Array(KMAX);
  let smoothHulls: number[][][] = [];
  let fitMs = 0;
  let stepMs = 0;
  let pointer: { x: number; y: number } | null = null;
  let pointerAge = 1e9; // Sekunden seit der letzten Zeigerbewegung
  let scare = 0;
  let seeded = false;
  let t = 0;
  let needClear = true;

  function seed() {
    seeded = true;
    N = Math.max(800, Math.min(MAX_N, Math.round((W * H) / 300)));
    for (let i = 0; i < N; i++) {
      const g = i % 3;
      px[i] = W * (0.22 + 0.28 * g) + (rng() - 0.5) * W * 0.14;
      py[i] = H * (0.3 + 0.4 * rng());
      const a = rng() * Math.PI * 2;
      vx[i] = Math.cos(a) * 60;
      vy[i] = Math.sin(a) * 60;
      fear[i] = 0;
    }
    for (let c = 0; c < KMAX; c++) {
      const i = Math.floor(rng() * N);
      centers[c * 2] = px[i];
      centers[c * 2 + 1] = py[i];
    }
    for (let kk = 1; kk <= KMAX; kk++) kept[kk].set(centers);
  }
  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
    needClear = true;
    if (!seeded) seed();
  }

  // ---- Nachbarschaft über ein Gitter -----------------------------------------
  const cellHead = new Int32Array(8192);
  const next = new Int32Array(MAX_N);
  let cols = 1;
  let rows = 1;
  function buildGrid() {
    cols = Math.max(1, Math.ceil(W / SEE));
    rows = Math.max(1, Math.ceil(H / SEE));
    cellHead.fill(-1, 0, cols * rows);
    for (let i = 0; i < N; i++) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(px[i] / SEE)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(py[i] / SEE)));
      const cell = cy * cols + cx;
      next[i] = cellHead[cell];
      cellHead[cell] = i;
    }
  }

  // Jäger: der Zeiger, oder nach zwei Sekunden Ruhe ein eigener auf stiller Bahn
  function hunter(): { x: number; y: number; r: number } | null {
    if (pointer && pointerAge < 2) return { x: pointer.x, y: pointer.y, r: 90 + scare * 160 };
    const hx = W / 2 + Math.sin(t * 0.21) * W * 0.36 + Math.sin(t * 0.07) * W * 0.1;
    const hy = H / 2 + Math.sin(t * 0.33 + 1.7) * H * 0.34;
    return { x: hx, y: hy, r: 70 };
  }

  function move(dt: number) {
    const t0 = performance.now();
    buildGrid();
    const hunt = hunter();
    // Wind: ein langsames, wirbelndes Feld
    const wx0 = Math.sin(t * 0.17) * 11;
    const wy0 = Math.cos(t * 0.13) * 7;
    // Der Platz des Schwarms wandert langsam über die ganze Fläche
    const roostR = Math.min(W, H) * 0.34;
    const rx = W / 2 + Math.sin(t * 0.09) * (W / 2 - roostR * 0.9);
    const ry = H / 2 + Math.sin(t * 0.14 + 2.1) * (H / 2 - roostR * 0.8);
    for (let i = 0; i < N; i++) {
      let ax = 0;
      let ay = 0;
      let cx = 0;
      let cy = 0;
      let hx = 0;
      let hy = 0;
      let n = 0;
      let nf = 0;
      const gx = Math.min(cols - 1, Math.max(0, Math.floor(px[i] / SEE)));
      const gy = Math.min(rows - 1, Math.max(0, Math.floor(py[i] / SEE)));
      const f = fear[i];
      const apart = APART * (1 + 1.6 * f);
      for (let oy = -1; oy <= 1 && n < NEIGHBORS; oy++) {
        for (let ox = -1; ox <= 1 && n < NEIGHBORS; ox++) {
          const qx = gx + ox;
          const qy = gy + oy;
          if (qx < 0 || qy < 0 || qx >= cols || qy >= rows) continue;
          for (let j = cellHead[qy * cols + qx]; j !== -1 && n < NEIGHBORS; j = next[j]) {
            if (j === i) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const d2 = dx * dx + dy * dy;
            if (d2 > SEE * SEE) continue;
            const d = Math.sqrt(d2) || 1e-3;
            n++;
            cx += px[j];
            cy += py[j];
            hx += vx[j];
            hy += vy[j];
            if (fear[j] > nf) nf = fear[j];
            if (d < apart) {
              ax -= (dx / d) * (apart - d) * 16;
              ay -= (dy / d) * (apart - d) * 16;
            }
          }
        }
      }
      if (n) {
        ax += (cx / n - px[i]) * (0.95 - 0.7 * f);
        ay += (cy / n - py[i]) * (0.95 - 0.7 * f);
        ax += (hx / n - vx[i]) * 3.4;
        ay += (hy / n - vy[i]) * 3.4;
      }
      // Zug zur Mitte, sobald es weit hinaus geht: der Schwarm bleibt über seinem Platz
      {
        const dx = rx - px[i];
        const dy = ry - py[i];
        const d = Math.hypot(dx, dy);
        if (d > roostR) {
          const s = (d - roostR) / roostR;
          ax += (dx / d) * s * 70;
          ay += (dy / d) * s * 70;
        }
      }
      // Angst steckt an und klingt ab
      let nfear = Math.max(f * 0.93, nf * 0.9);
      if (hunt) {
        const dx = px[i] - hunt.x;
        const dy = py[i] - hunt.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < hunt.r * hunt.r) {
          const d = Math.sqrt(d2) || 1e-3;
          const s = (hunt.r - d) / hunt.r;
          ax += (dx / d) * s * 900;
          ay += (dy / d) * s * 900;
          nfear = Math.max(nfear, s);
        }
      }
      fearNext[i] = nfear;
      // Wind mit örtlichem Wirbel
      ax += wx0 + Math.sin(py[i] * 0.012 + t * 0.4) * 8;
      ay += wy0 + Math.cos(px[i] * 0.01 - t * 0.3) * 6;
      // sanfter Rand
      const m = 40;
      if (px[i] < m) ax += (m - px[i]) * 9;
      if (px[i] > W - m) ax -= (px[i] - (W - m)) * 9;
      if (py[i] < m) ay += (m - py[i]) * 9;
      if (py[i] > H - m) ay -= (py[i] - (H - m)) * 9;
      ax += (rng() - 0.5) * 24;
      ay += (rng() - 0.5) * 24;
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      const sp = Math.hypot(vx[i], vy[i]) || 1e-3;
      const want = 58 * (0.85 + (0.3 * ((i * 7919) % 11)) / 11) * (1 + 1.3 * f);
      const g = sp > want ? want / sp : 1 + (want / sp - 1) * 0.15;
      vx[i] *= g;
      vy[i] *= g;
    }
    for (let i = 0; i < N; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      fear[i] = fearNext[i];
    }
    scare *= 0.93;
    stepMs = performance.now() - t0;
  }

  // ---- k-means mit Wahl der Gruppenzahl --------------------------------------
  const tmpLabel = new Int8Array(MAX_N);
  const tmpCenters = new Float32Array(KMAX * 2);
  const kept = Array.from({ length: KMAX + 1 }, () => new Float32Array(KMAX * 2));
  const sum = new Float64Array(KMAX * 3);

  function kmeans(kk: number, cen: Float32Array, lab: Int8Array, iters: number): number {
    let inertia = 0;
    for (let it = 0; it < iters; it++) {
      sum.fill(0);
      inertia = 0;
      for (let i = 0; i < N; i++) {
        let best = 0;
        let bd = Infinity;
        for (let c = 0; c < kk; c++) {
          const dx = px[i] - cen[c * 2];
          const dy = py[i] - cen[c * 2 + 1];
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        lab[i] = best;
        inertia += bd;
        sum[best * 3] += px[i];
        sum[best * 3 + 1] += py[i];
        sum[best * 3 + 2]++;
      }
      for (let c = 0; c < kk; c++) {
        if (sum[c * 3 + 2] > 0) {
          cen[c * 2] = sum[c * 3] / sum[c * 3 + 2];
          cen[c * 2 + 1] = sum[c * 3 + 1] / sum[c * 3 + 2];
        } else {
          const i = Math.floor(rng() * N);
          cen[c * 2] = px[i];
          cen[c * 2 + 1] = py[i];
        }
      }
    }
    return inertia;
  }

  function smooth(poly: number[][], rounds: number): number[][] {
    let p = poly;
    for (let r = 0; r < rounds; r++) {
      const q: number[][] = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i];
        const b = p[(i + 1) % p.length];
        q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        q.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      p = q;
    }
    return p;
  }

  function cluster() {
    const t0 = performance.now();
    const inertia: number[] = [];
    for (let kk = 1; kk <= KMAX; kk++) {
      tmpCenters.set(kept[kk]);
      inertia[kk] = kmeans(kk, tmpCenters, tmpLabel, 2);
      kept[kk].set(tmpCenters);
    }
    let choose = 1;
    for (let kk = 1; kk < KMAX; kk++) {
      if (inertia[kk + 1] / inertia[kk] < 0.6) choose = kk + 1;
      else break;
    }
    if (Math.abs(choose - k) === 1 && rng() < 0.75) choose = k;
    k = choose;
    centers.set(kept[k]);
    kmeans(k, centers, label, 1);
    kept[k].set(centers);
    const spread = new Float64Array(k);
    members.fill(0);
    for (let i = 0; i < N; i++) {
      const c = label[i];
      const dx = px[i] - centers[c * 2];
      const dy = py[i] - centers[c * 2 + 1];
      spread[c] += dx * dx + dy * dy;
      members[c]++;
    }
    for (let c = 0; c < k; c++) spread[c] = Math.sqrt(spread[c] / Math.max(1, members[c]));
    for (let i = 0; i < N; i++) {
      const c = label[i];
      const d = Math.hypot(px[i] - centers[c * 2], py[i] - centers[c * 2 + 1]);
      outlier[i] = d > OUT_Z * spread[c] ? 1 : 0;
    }
    smoothHulls = [];
    for (let c = 0; c < k; c++) {
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (label[i] === c && !outlier[i]) idx.push(i);
      if (idx.length < 3) {
        smoothHulls.push([]);
        continue;
      }
      idx.sort((a, b) => px[a] - px[b] || py[a] - py[b]);
      const cross = (o: number, a: number, b: number) => (px[a] - px[o]) * (py[b] - py[o]) - (py[a] - py[o]) * (px[b] - px[o]);
      const lower: number[] = [];
      for (const i of idx) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
        lower.push(i);
      }
      const upper: number[] = [];
      for (let q = idx.length - 1; q >= 0; q--) {
        const i = idx[q];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
        upper.push(i);
      }
      lower.pop();
      upper.pop();
      const hull = lower.concat(upper);
      const cx = centers[c * 2];
      const cy = centers[c * 2 + 1];
      const padded = hull.map((i) => {
        const dx = px[i] - cx;
        const dy = py[i] - cy;
        const d = Math.hypot(dx, dy) || 1;
        return [px[i] + (dx / d) * 10, py[i] + (dy / d) * 10];
      });
      smoothHulls.push(smooth(padded, 3));
    }
    fitMs = performance.now() - t0;
  }

  function draw() {
    const c = ctx!;
    // Nachleuchten: das letzte Bild bleibt leicht stehen
    if (needClear || !live) {
      c.clearRect(0, 0, W, H);
      needClear = false;
    } else {
      c.fillStyle = rgba(colors.papier, 0.3);
      c.fillRect(0, 0, W, H);
    }
    c.font = MONO;
    c.textBaseline = 'middle';
    // Hüllen nur als Hairline, damit das Nachleuchten sie nicht verschmiert
    c.lineWidth = 1;
    c.setLineDash([2, 4]);
    for (let g = 0; g < smoothHulls.length; g++) {
      const h = smoothHulls[g];
      if (h.length < 3) continue;
      c.beginPath();
      h.forEach((p, q) => (q ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.strokeStyle = colors.blei;
      c.globalAlpha = 0.5;
      c.stroke();
      c.globalAlpha = 1;
    }
    c.setLineDash([]);
    // Individuen: kleine Punkte, Dichte entsteht durch Überlagerung
    const dot = 1.7;
    c.fillStyle = colors.graphit;
    c.globalAlpha = 0.85;
    for (let i = 0; i < N; i++) {
      if (outlier[i]) continue;
      c.fillRect(px[i] - dot / 2, py[i] - dot / 2, dot, dot);
    }
    c.fillStyle = colors.signal;
    c.globalAlpha = 1;
    for (let i = 0; i < N; i++) {
      if (!outlier[i]) continue;
      c.fillRect(px[i] - 1.5, py[i] - 1.5, 3, 3);
    }
    // Beschriftung der Gruppen
    c.fillStyle = colors.blei;
    c.textAlign = 'left';
    for (let g = 0; g < k; g++) {
      const cx = centers[g * 2];
      const cy = centers[g * 2 + 1];
      c.strokeStyle = colors.blei;
      c.beginPath();
      c.moveTo(cx - 5, cy);
      c.lineTo(cx + 5, cy);
      c.moveTo(cx, cy - 5);
      c.lineTo(cx, cy + 5);
      c.stroke();
      c.fillText(`${g + 1} · ${members[g]}`, cx + 9, cy - 9);
    }
    // Der Jäger, wenn er von allein unterwegs ist
    const h = hunter();
    if (h && !(pointer && pointerAge < 2)) {
      c.strokeStyle = colors.blei;
      c.globalAlpha = 0.6;
      c.beginPath();
      c.arc(h.x, h.y, 4, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    let o = 0;
    for (let i = 0; i < N; i++) o += outlier[i];
    set([String(N), String(k), String(o), (stepMs + fitMs).toFixed(1) + ' ms']);
  }

  resize();
  for (let s = 0; s < 240; s++) {
    t += 1 / 30;
    move(1 / 30);
  }
  cluster();
  if (!live) {
    draw();
    updateReadout(0, true);
    const stopStill = stillImage(canvas, resize, draw);
    return () => {
      stopStill();
      ac.abort();
    };
  }

  let sinceCluster = 0;
  const stopLoop = runLoop(
    canvas,
    {
      frame(dt, now) {
        const h = Math.min(dt, 1 / 30);
        t += h;
        pointerAge += h;
        move(h);
        sinceCluster += h;
        if (sinceCluster > 0.15) {
          sinceCluster = 0;
          cluster();
        }
        updateReadout(now);
      },
      draw: () => draw(),
      resize,
      recolor: () => {
        colors = readColors(canvas);
        needClear = true;
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
      if (ev.pointerType === 'mouse' || ev.buttons > 0) {
        pointer = local(ev);
        pointerAge = 0;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (ev) => {
      pointer = local(ev);
      pointerAge = 0;
      scare = 1;
    },
    { signal },
  );
  const release = () => {
    pointerAge = 1e9;
  };
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener('pointerleave', release, { signal });
  canvas.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        pointer = { x: W / 2, y: H / 2 };
        pointerAge = 0;
        scare = 1;
        setTimeout(() => (pointerAge = 1e9), 500);
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
