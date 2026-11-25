/**
 * Ordnung im Schwarm. Vierhundert Punkte folgen drei einfachen Regeln:
 * Abstand halten, Richtung angleichen, zusammenbleiben. Gruppen entstehen von
 * selbst. Ein Clustering (k-means, die Zahl der Gruppen wird laufend aus den
 * Daten gewählt) findet sie und legt eine weiche Hülle um jede; wer weit
 * von seiner Gruppe entfernt ist, wird Bernstein. Schweife zeigen die Bewegung.
 */
import { hint, mulberry32, readColors, readout, runLoop, setupCanvas, stillImage, MONO, type Colors, type Rng, type UI, type Unmount } from './ui';

const N = 400;
const KMAX = 5;
const SPEED = 75;
const SEE = 56;
const APART = 14;
const OUT_Z = 2.2;
const TRAIL = 9;

export const HINWEIS_SCHWARM =
  'Vierhundert Punkte, drei Regeln, kein Plan: Gruppen entstehen von selbst, ein Clustering findet sie und markiert Außenseiter. Maus verscheucht.';

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
  canvas.setAttribute('aria-label', 'Ein Schwarm aus 400 Punkten folgt einfachen Regeln; ein Clustering findet live die Gruppen und umreißt sie');

  let colors: Colors = readColors(canvas);
  let W = 0;
  let H = 0;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const label = new Int8Array(N);
  const outlier = new Uint8Array(N);
  const trail = new Float32Array(N * TRAIL * 2);
  let trailHead = 0;
  let trailN = 0;
  let k = 1;
  const centers = new Float32Array(KMAX * 2);
  const hulls: number[][] = [];
  const members = new Int32Array(KMAX);
  let fitMs = 0;
  let pointer: { x: number; y: number } | null = null;
  let scare = 0;
  let seeded = false;

  function resize() {
    ({ W, H } = setupCanvas(canvas, ctx!));
    if (!seeded) {
      seeded = true;
      for (let i = 0; i < N; i++) {
        const g = i % 3;
        px[i] = W * (0.2 + 0.3 * g) + (rng() - 0.5) * W * 0.16;
        py[i] = H * (0.25 + 0.5 * rng());
        const a = rng() * Math.PI * 2;
        vx[i] = Math.cos(a) * SPEED;
        vy[i] = Math.sin(a) * SPEED;
      }
      for (let c = 0; c < KMAX; c++) {
        const i = Math.floor(rng() * N);
        centers[c * 2] = px[i];
        centers[c * 2 + 1] = py[i];
      }
      for (let kk = 1; kk <= KMAX; kk++) kept[kk].set(centers);
    }
  }

  // ---- Nachbarschaft über ein Gitter -----------------------------------------
  const cellHead = new Int32Array(4096);
  const next = new Int32Array(N);
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

  function move(dt: number) {
    buildGrid();
    for (let i = 0; i < N; i++) {
      let ax = 0;
      let ay = 0;
      let cx = 0;
      let cy = 0;
      let hx = 0;
      let hy = 0;
      let n = 0;
      const gx = Math.min(cols - 1, Math.max(0, Math.floor(px[i] / SEE)));
      const gy = Math.min(rows - 1, Math.max(0, Math.floor(py[i] / SEE)));
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const qx = gx + ox;
          const qy = gy + oy;
          if (qx < 0 || qy < 0 || qx >= cols || qy >= rows) continue;
          for (let j = cellHead[qy * cols + qx]; j !== -1; j = next[j]) {
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
            if (d < APART) {
              ax -= (dx / d) * (APART - d) * 7;
              ay -= (dy / d) * (APART - d) * 7;
            }
          }
        }
      }
      if (n) {
        ax += (cx / n - px[i]) * 1.4;
        ay += (cy / n - py[i]) * 1.4;
        ax += (hx / n - vx[i]) * 2.4;
        ay += (hy / n - vy[i]) * 2.4;
      }
      const m = 60;
      if (px[i] < m) ax += (m - px[i]) * 12;
      if (px[i] > W - m) ax -= (px[i] - (W - m)) * 12;
      if (py[i] < m) ay += (m - py[i]) * 12;
      if (py[i] > H - m) ay -= (py[i] - (H - m)) * 12;
      if (pointer) {
        const dx = px[i] - pointer.x;
        const dy = py[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        const r = 100 + scare * 140;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1e-3;
          ax += (dx / d) * (r - d) * 16;
          ay += (dy / d) * (r - d) * 16;
        }
      }
      ax += (rng() - 0.5) * 30;
      ay += (rng() - 0.5) * 30;
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      const sp = Math.hypot(vx[i], vy[i]) || 1e-3;
      const want = SPEED * (0.8 + (0.4 * ((i * 7919) % 13)) / 13) * (1 + scare * 0.8);
      const f = sp > want ? want / sp : 1 + (want / sp - 1) * 0.1;
      vx[i] *= f;
      vy[i] *= f;
    }
    for (let i = 0; i < N; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
    scare *= 0.92;
  }

  function record() {
    for (let i = 0; i < N; i++) {
      trail[(i * TRAIL + trailHead) * 2] = px[i];
      trail[(i * TRAIL + trailHead) * 2 + 1] = py[i];
    }
    trailHead = (trailHead + 1) % TRAIL;
    if (trailN < TRAIL) trailN++;
  }

  // ---- k-means mit Wahl der Gruppenzahl --------------------------------------
  const tmpLabel = new Int8Array(N);
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

  /** Chaikin: Ecken abrunden */
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
  let smoothHulls: number[][][] = [];

  function cluster() {
    const t0 = performance.now();
    const inertia: number[] = [];
    for (let kk = 1; kk <= KMAX; kk++) {
      tmpCenters.set(kept[kk]);
      inertia[kk] = kmeans(kk, tmpCenters, tmpLabel, 3);
      kept[kk].set(tmpCenters);
    }
    let choose = 1;
    for (let kk = 1; kk < KMAX; kk++) {
      if (inertia[kk + 1] / inertia[kk] < 0.62) choose = kk + 1;
      else break;
    }
    if (Math.abs(choose - k) === 1 && rng() < 0.7) choose = k;
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
    hulls.length = 0;
    smoothHulls = [];
    for (let c = 0; c < k; c++) {
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (label[i] === c && !outlier[i]) idx.push(i);
      if (idx.length < 3) {
        hulls.push([]);
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
      hulls.push(hull);
      // Hülle etwas nach außen schieben, dann runden
      const cx = centers[c * 2];
      const cy = centers[c * 2 + 1];
      const padded = hull.map((i) => {
        const dx = px[i] - cx;
        const dy = py[i] - cy;
        const d = Math.hypot(dx, dy) || 1;
        return [px[i] + (dx / d) * 14, py[i] + (dy / d) * 14];
      });
      smoothHulls.push(smooth(padded, 3));
    }
    fitMs = performance.now() - t0;
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';
    c.lineWidth = 1;
    for (let g = 0; g < smoothHulls.length; g++) {
      const h = smoothHulls[g];
      if (h.length < 3) continue;
      c.beginPath();
      h.forEach((p, q) => (q ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fillStyle = colors.band;
      c.fill();
      c.strokeStyle = colors.blei;
      c.globalAlpha = 0.55;
      c.stroke();
      c.globalAlpha = 1;
      const cx = centers[g * 2];
      const cy = centers[g * 2 + 1];
      c.strokeStyle = colors.blei;
      c.beginPath();
      c.moveTo(cx - 5, cy);
      c.lineTo(cx + 5, cy);
      c.moveTo(cx, cy - 5);
      c.lineTo(cx, cy + 5);
      c.stroke();
      c.fillStyle = colors.blei;
      c.textAlign = 'left';
      c.fillText(`Gruppe ${g + 1} · ${members[g]}`, cx + 9, cy - 9);
    }
    // Schweife
    if (trailN > 1) {
      c.lineWidth = 1;
      c.lineCap = 'round';
      c.strokeStyle = colors.graphit;
      c.globalAlpha = 0.16;
      c.beginPath();
      for (let i = 0; i < N; i++) {
        for (let s = 0; s < trailN; s++) {
          const idx = (trailHead - trailN + s + TRAIL) % TRAIL;
          const x = trail[(i * TRAIL + idx) * 2];
          const y = trail[(i * TRAIL + idx) * 2 + 1];
          if (s === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.lineTo(px[i], py[i]);
      }
      c.stroke();
      c.globalAlpha = 1;
    }
    // Individuen als Striche in Bewegungsrichtung
    c.lineWidth = 1.8;
    for (const want of [0, 1]) {
      c.strokeStyle = want ? colors.bernstein : colors.graphit;
      c.beginPath();
      for (let i = 0; i < N; i++) {
        if (outlier[i] !== want) continue;
        const sp = Math.hypot(vx[i], vy[i]) || 1;
        const ux = (vx[i] / sp) * 4.5;
        const uy = (vy[i] / sp) * 4.5;
        c.moveTo(px[i] - ux, py[i] - uy);
        c.lineTo(px[i] + ux, py[i] + uy);
      }
      c.stroke();
    }
  }

  let lastReadout = 0;
  function updateReadout(now: number, force = false) {
    if (!force && now - lastReadout < 150) return;
    lastReadout = now;
    let o = 0;
    for (let i = 0; i < N; i++) o += outlier[i];
    set([String(N), String(k), String(o), fitMs.toFixed(1) + ' ms']);
  }

  resize();
  for (let s = 0; s < 150; s++) {
    move(1 / 30);
    if (s % 2 === 0) record();
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
  let frames = 0;
  const stopLoop = runLoop(
    canvas,
    {
      frame(dt, now) {
        move(Math.min(dt, 1 / 30));
        if (++frames % 2 === 0) record();
        sinceCluster += dt;
        if (sinceCluster > 0.1) {
          sinceCluster = 0;
          cluster();
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
  canvas.addEventListener(
    'pointermove',
    (ev) => {
      if (ev.pointerType === 'mouse' || ev.buttons > 0) pointer = local(ev);
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (ev) => {
      pointer = local(ev);
      scare = 1;
    },
    { signal },
  );
  const release = () => (pointer = null);
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener('pointerleave', release, { signal });
  canvas.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        pointer = { x: W / 2, y: H / 2 };
        scare = 1;
        setTimeout(() => (pointer = null), 400);
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
