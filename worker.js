// worker.js - Fixed-point Mandelbrot renderer (BigInt) with smooth coloring
// Version v9.5.2

function clamp01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }

// v1-like smooth palette (sin waves)
function colorFromMu(mu){
  const t = mu * 0.035;
  const r = 0.55 + 0.45 * Math.sin(t + 0.0);
  const g = 0.55 + 0.45 * Math.sin(t + 2.094);
  const b = 0.55 + 0.45 * Math.sin(t + 4.188);
  return [(clamp01(r)*255)|0, (clamp01(g)*255)|0, (clamp01(b)*255)|0, 255];
}

function log2BigInt(n){
  if (n <= 0n) return -Infinity;
  const bits = n.toString(2).length;
  const shift = Math.max(0, bits - 53);
  const top = Number(shift ? (n >> BigInt(shift)) : n);
  return Math.log2(top) + shift;
}

function mandelbrotMu(cx, cy, bits, maxIter){
  let zx = 0n, zy = 0n;
  const escape2 = 4n << BigInt(bits*2); // 4 in fixed-point squared domain
  for (let i=0; i<maxIter; i++) {
    // zx2 = zx*zx, zy2 = zy*zy in Q(2*bits)
    const zx2 = zx*zx;
    const zy2 = zy*zy;
    const mag2 = zx2 + zy2;
    if (mag2 > escape2) {
      // Smooth iteration count:
      // mu = i + 1 - log2(log(|z|))
      const log2_mag2 = log2BigInt(mag2) - (2*bits); // log2(|z|^2)
      const log2_abs  = 0.5 * log2_mag2;             // log2(|z|)
      const ln_abs = log2_abs * Math.LN2;
      const mu = (ln_abs > 0) ? (i + 1 - Math.log2(ln_abs)) : i;
      return { inside:false, i, mu };
    }
    // z = z^2 + c
    // zx' = zx^2 - zy^2 + cx, zy' = 2*zx*zy + cy (shifted back to Q(bits))
    const two_zxzy = (zx*zy) >> BigInt(bits-1); // (2*zx*zy) >> bits
    const nx = ((zx2 - zy2) >> BigInt(bits)) + cx;
    const ny = two_zxzy + cy;
    zx = nx;
    zy = ny;
  }
  return { inside:true, i:maxIter, mu:maxIter };
}

self.onmessage = (ev) => {
  const m = ev.data;
  if (!m || m.type !== "job") return;
  const { token, W, startY, rows, step, maxIter, bits, xmin, ymin, scale } = m;
  const out = new Uint8ClampedArray(W * rows * 4);

  for (let yy=0; yy<rows; yy+=step) {
    const y = startY + yy;
    const cy = ymin + (BigInt(y) * scale);
    for (let xx=0; xx<W; xx+=step) {
      const cx = xmin + (BigInt(xx) * scale);
      const r = mandelbrotMu(cx, cy, bits, maxIter);
      const rgba = r.inside ? [0,0,0,255] : colorFromMu(r.mu);

      const yMax = Math.min(rows, yy + step);
      const xMax = Math.min(W, xx + step);
      for (let y2=yy; y2<yMax; y2++) {
        let idx = (y2 * W + xx) * 4;
        for (let x2=xx; x2<xMax; x2++) {
          out[idx++] = rgba[0];
          out[idx++] = rgba[1];
          out[idx++] = rgba[2];
          out[idx++] = 255;
        }
      }
    }
  }

  // Transfer
  self.postMessage({ type:"strip", token, startY, buffer: out.buffer }, [out.buffer]);
};
