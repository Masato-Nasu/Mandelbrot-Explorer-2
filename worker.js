// Mandelbrot Worker v8: UltraDeep(BigInt fixed-point) + Perturbation(fast)
//
// Messages:
//  - {type:"setOrbit", token, iters, orbitBuffer}  orbitBuffer: ArrayBuffer of Float64Array length iters*2 (zx,zy per iter)
//  - {type:"job", ...}                            UltraDeep strip (same as v7)
//  - {type:"jobPert", ...}                        Perturbation strip

// ---------- Shared helpers ----------
function color(i, maxIter) {
  if (i >= maxIter) return [0,0,0,255];
  const t = i / maxIter;
  const a = 0.5 + 0.5*Math.sin(6.28318*(t*3.0 + 0.00));
  const b = 0.5 + 0.5*Math.sin(6.28318*(t*3.0 + 0.33));
  const c = 0.5 + 0.5*Math.sin(6.28318*(t*3.0 + 0.66));
  return [(a*255)|0,(b*255)|0,(c*255)|0,255];
}

// ---------- UltraDeep (fixed-point BigInt) ----------
function mulFixed(a, b, bits) { return (a * b) >> BigInt(bits); }

function mandelbrotFixed(cx, cy, bits, maxIter) {
  let x = 0n, y = 0n;
  const escape = 4n << BigInt(bits);
  for (let i = 0; i < maxIter; i++) {
    const x2 = mulFixed(x, x, bits);
    const y2 = mulFixed(y, y, bits);
    if (x2 + y2 > escape) return i;

    const xy = mulFixed(x, y, bits);
    const nx = x2 - y2 + cx;
    const ny = (2n * xy) + cy;
    x = nx; y = ny;
  }
  return maxIter;
}

// ---------- Perturbation (fast) ----------
const orbitMap = new Map(); // token -> Float64Array

function mandelbrotPerturb(dcRe, dcIm, orbit, maxIter) {
  // dz starts at 0
  let dzx = 0.0, dzy = 0.0;
  for (let i = 0; i < maxIter; i++) {
    const zx = orbit[i*2];
    const zy = orbit[i*2 + 1];

    // z = z_ref + dz
    const rx = zx + dzx;
    const ry = zy + dzy;
    if (rx*rx + ry*ry > 4.0) return i;

    // dz_{n+1} = 2*z_ref*dz + dz^2 + dc
    // 2*z_ref*dz
    const aRe = 2.0*(zx*dzx - zy*dzy);
    const aIm = 2.0*(zx*dzy + zy*dzx);

    // dz^2
    const bRe = dzx*dzx - dzy*dzy;
    const bIm = 2.0*dzx*dzy;

    dzx = aRe + bRe + dcRe;
    dzy = aIm + bIm + dcIm;
  }
  return maxIter;
}

self.onmessage = (ev) => {
  const m = ev.data;
  if (!m || !m.type) return;

  if (m.type === "setOrbit") {
    try {
      const arr = new Float64Array(m.orbitBuffer);
      orbitMap.set(m.token, arr);
    } catch {}
    return;
  }

  if (m.type === "job") {
    // UltraDeep strip
    const { token, W, startY, rows, step, maxIter, bits, xmin, ymin, scale } = m;
    const out = new Uint8ClampedArray(W * rows * 4);

    for (let yy = 0; yy < rows; yy += step) {
      const y = startY + yy;
      const cy = ymin + (BigInt(y) * scale);
      for (let xx = 0; xx < W; xx += step) {
        const cx = xmin + (BigInt(xx) * scale);
        const it = mandelbrotFixed(cx, cy, bits, maxIter);
        const [r,g,b,a] = color(it, maxIter);

        const yMax = Math.min(rows, yy + step);
        const xMax = Math.min(W, xx + step);
        for (let by = yy; by < yMax; by++) {
          let idx = (by * W + xx) * 4;
          for (let bx = xx; bx < xMax; bx++) {
            out[idx]=r; out[idx+1]=g; out[idx+2]=b; out[idx+3]=a;
            idx += 4;
          }
        }
      }
    }

    self.postMessage({ type:"strip", token, startY, rows, buffer: out.buffer }, [out.buffer]);
    return;
  }

  if (m.type === "jobPert") {
    const { token, W, startY, rows, step, maxIter, xminF, yminF, scaleF, cRefX, cRefY } = m;
    const orbit = orbitMap.get(token);
    if (!orbit || orbit.length < maxIter*2) {
      // orbit not ready; return empty
      return;
    }

    const out = new Uint8ClampedArray(W * rows * 4);

    for (let yy = 0; yy < rows; yy += step) {
      const y = startY + yy;
      const cy = yminF + y * scaleF;
      for (let xx = 0; xx < W; xx += step) {
        const cx = xminF + xx * scaleF;

        const dcRe = cx - cRefX;
        const dcIm = cy - cRefY;

        const it = mandelbrotPerturb(dcRe, dcIm, orbit, maxIter);
        const [r,g,b,a] = color(it, maxIter);

        const yMax = Math.min(rows, yy + step);
        const xMax = Math.min(W, xx + step);
        for (let by = yy; by < yMax; by++) {
          let idx = (by * W + xx) * 4;
          for (let bx = xx; bx < xMax; bx++) {
            out[idx]=r; out[idx+1]=g; out[idx+2]=b; out[idx+3]=a;
            idx += 4;
          }
        }
      }
    }

    self.postMessage({ type:"strip", token, startY, rows, buffer: out.buffer }, [out.buffer]);
    return;
  }
};
