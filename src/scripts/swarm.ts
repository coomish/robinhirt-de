/**
 * Ordnung im Schwarm. Zweihundert Punkte folgen drei einfachen Regeln:
 * Abstand halten, Richtung angleichen, zusammenbleiben. Daraus entstehen
 * Gruppen, ohne dass jemand sie plant. Ein Clustering (k-means, die Zahl der
 * Gruppen wird laufend aus den Daten gewählt) findet die Gruppen und umreißt
 * sie; wer weit von seiner Gruppe entfernt ist, wird Bernstein. Alles lokal.
 */
import { hint, mulberry32, readColors, readout, runLoop, setupCanvas, MONO, type Colors, type Rng, type UI } from './ui';

const N = 260;
const KMAX = 5;
const SPEED = 70; // px/s
const SEE = 60; // Sichtweite
const APART = 15; // Mindestabstand
const OUT_Z = 2.2; // Ausreißer ab so vielen Streuungen vom Gruppenmittel

export const HINWEIS_SCHWARM =
  'Zweihundertsechzig Punkte folgen drei einfachen Regeln: Abstand halten, Richtung angleichen, zusammenbleiben. Gruppen entstehen von selbst. Ein Clustering (k-means) wählt laufend die Zahl der Gruppen aus den Daten, umreißt sie und markiert, wer nicht dazugehört. Alles rechnet lokal im Browser. Maus oder Finger verscheuchen den Schwarm.';

export function mountSwarm(canvas: HTMLCanvasElement, ui: UI = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = !reduced.matches;
  const rng: Rng = live ? Math.random : mulberry32(2018);
  const set = readout(ui, ['Individuen', 'Gruppen', 'Außenseiter', 'Rechenzeit']);
  hint(
    ui,
    live
      ? HINWEIS_SCHWARM
      : 'Standbild, da reduzierte Bewegung eingestellt ist: ein Schwarm nach drei einfachen Regeln, Gruppen per k-means gefunden und umrissen, Außenseiter in Bernstein. Gerechnet lokal im Browser.',
  );
  canvas.setAttribute(
    'aria-label',
    'Ein Schwarm aus 260 Punkten folgt einfachen Regeln; ein Clustering findet live die Gruppen und umreißt sie',
  );

  let colors: Colors = readColors(canvas);
  let W = 0;
  let H = 0;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const label = new Int8Array(N);
  const outlier = new Uint8Array(N);
  let k = 1;
  const centers = new Float32Array(KMAX * 2);
  const hulls: number[][] = [];
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
        px[i] = W * (0.2 + 0.3 * g) + (rng() - 0.5) * W * 0.18;
        py[i] = H * (0.3 + 0.4 * rng());
        const a = rng() * Math.PI * 2;
        vx[i] = Math.cos(a) * SPEED;
        vy[i] = Math.sin(a) * SPEED;
      }
      for (let c = 0; c < KMAX; c++) {
        const i = Math.floor(rng() * N);
        centers[c * 2] = px[i];
        centers[c * 2 + 1] = py[i];
      }
    }
  }

  // ---- Die drei Regeln -----------------------------------------------------
  function move(dt: number) {
    for (let i = 0; i < N; i++) {
      let ax = 0;
      let ay = 0;
      let cx = 0;
      let cy = 0;
      let hx = 0;
      let hy = 0;
      let n = 0;
      for (let j = 0; j < N; j++) {
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
          ax -= (dx / d) * (APART - d) * 6;
          ay -= (dy / d) * (APART - d) * 6;
        }
      }
      if (n) {
        ax += (cx / n - px[i]) * 1.3; // zusammenbleiben
        ay += (cy / n - py[i]) * 1.3;
        ax += (hx / n - vx[i]) * 2.4; // Richtung angleichen
        ay += (hy / n - vy[i]) * 2.4;
      }
      // sanfter Rand
      const m = 60;
      if (px[i] < m) ax += (m - px[i]) * 12;
      if (px[i] > W - m) ax -= (px[i] - (W - m)) * 12;
      if (py[i] < m) ay += (m - py[i]) * 12;
      if (py[i] > H - m) ay -= (py[i] - (H - m)) * 12;
      // Zeiger verscheucht
      if (pointer) {
        const dx = px[i] - pointer.x;
        const dy = py[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        const r = 90 + scare * 120;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1e-3;
          ax += (dx / d) * (r - d) * 14;
          ay += (dy / d) * (r - d) * 14;
        }
      }
      // etwas Eigensinn
      ax += (rng() - 0.5) * 30;
      ay += (rng() - 0.5) * 30;
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      const sp = Math.hypot(vx[i], vy[i]) || 1e-3;
      const want = SPEED * (0.8 + 0.4 * ((i * 7919) % 13) / 13);
      const f = sp > want ? want / sp : 1 + (want / sp - 1) * 0.1;
      vx[i] *= f;
      vy[i] *= f;
    }
    for (let i = 0; i < N; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
    scare *= 0.9;
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

  function cluster() {
    const t0 = performance.now();
    // Trägheit für k = 1 … KMAX, warm gestartet aus dem letzten Bild
    const inertia: number[] = [];
    for (let kk = 1; kk <= KMAX; kk++) {
      tmpCenters.set(kept[kk]);
      inertia[kk] = kmeans(kk, tmpCenters, tmpLabel, 3);
      kept[kk].set(tmpCenters);
    }
    // Wahl: solange eine weitere Gruppe die Trägheit noch deutlich senkt
    let choose = 1;
    for (let kk = 1; kk < KMAX; kk++) {
      if (inertia[kk + 1] / inertia[kk] < 0.62) choose = kk + 1;
      else break;
    }
    // Hysterese gegen Flackern
    if (Math.abs(choose - k) === 1 && rng() < 0.7) choose = k;
    k = choose;
    centers.set(kept[k]);
    kmeans(k, centers, label, 1);
    kept[k].set(centers);
    // Außenseiter: weiter als OUT_Z Streuungen vom Gruppenmittel
    const spread = new Float64Array(k);
    const cnt = new Int32Array(k);
    for (let i = 0; i < N; i++) {
      const c = label[i];
      const dx = px[i] - centers[c * 2];
      const dy = py[i] - centers[c * 2 + 1];
      spread[c] += dx * dx + dy * dy;
      cnt[c]++;
    }
    for (let c = 0; c < k; c++) spread[c] = Math.sqrt(spread[c] / Math.max(1, cnt[c]));
    for (let i = 0; i < N; i++) {
      const c = label[i];
      const d = Math.hypot(px[i] - centers[c * 2], py[i] - centers[c * 2 + 1]);
      outlier[i] = d > OUT_Z * spread[c] ? 1 : 0;
    }
    // Hüllen je Gruppe (Andrew)
    hulls.length = 0;
    for (let c = 0; c < k; c++) {
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (label[i] === c && !outlier[i]) idx.push(i);
      if (idx.length < 3) {
        hulls.push([]);
        continue;
      }
      idx.sort((a, b) => px[a] - px[b] || py[a] - py[b]);
      const cross = (o: number, a: number, b: number) =>
        (px[a] - px[o]) * (py[b] - py[o]) - (py[a] - py[o]) * (px[b] - px[o]);
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
      hulls.push(lower.concat(upper));
    }
    fitMs = performance.now() - t0;
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, W, H);
    c.font = MONO;
    c.textBaseline = 'middle';
    // Hüllen
    c.lineWidth = 1;
    for (let g = 0; g < hulls.length; g++) {
      const h = hulls[g];
      if (h.length < 3) continue;
      c.beginPath();
      h.forEach((i, q) => (q ? c.lineTo(px[i], py[i]) : c.moveTo(px[i], py[i])));
      c.closePath();
      c.fillStyle = colors.band;
      c.fill();
      c.strokeStyle = colors.blei;
      c.globalAlpha = 0.7;
      c.stroke();
      c.globalAlpha = 1;
      // Mittelpunkt als kleines Kreuz, Beschriftung
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
      let members = 0;
      for (let i = 0; i < N; i++) if (label[i] === g) members++;
      c.fillText(`Gruppe ${g + 1} · ${members}`, cx + 9, cy - 9);
    }
    // Individuen als kurze Striche in Bewegungsrichtung
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const sp = Math.hypot(vx[i], vy[i]) || 1;
      const ux = (vx[i] / sp) * 4;
      const uy = (vy[i] / sp) * 4;
      c.strokeStyle = outlier[i] ? colors.bernstein : colors.graphit;
      c.beginPath();
      c.moveTo(px[i] - ux, py[i] - uy);
      c.lineTo(px[i] + ux, py[i] + uy);
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
  for (let s = 0; s < 120; s++) move(1 / 30); // Vorlauf, damit sich Gruppen gebildet haben
  cluster();
  if (!live) {
    draw();
    updateReadout(0, true);
    new ResizeObserver(() => {
      resize();
      draw();
    }).observe(canvas);
    return;
  }

  let sinceCluster = 0;
  runLoop(
    canvas,
    {
      frame(dt, now) {
        move(Math.min(dt, 1 / 30));
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
  );

  const local = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse' || ev.buttons > 0) pointer = local(ev);
  });
  canvas.addEventListener('pointerdown', (ev) => {
    pointer = local(ev);
    scare = 1;
  });
  const release = () => {
    pointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      pointer = { x: W / 2, y: H / 2 };
      scare = 1;
      setTimeout(() => (pointer = null), 400);
    }
  });
}
