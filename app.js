// Mandelbrot Explorer UltraDeep v7 (stable rewrite)
(() => {
// ---- BigFloat (DeepNav) : value = m * 2^e (BigInt mantissa, integer exponent) ----
  function bfNorm(b){
    let m = b.m, e = b.e|0;
    if (m === 0n) return {m:0n, e:0};
    const abs = (m < 0n) ? -m : m;
    const bits = abs.toString(2).length;
    const target = 240; // keep mantissa around this size for speed
    if (bits > target){
      const sh = bits - target;
      const half = 1n << BigInt(sh-1);
      m = (m + (m>=0n?half:-half)) >> BigInt(sh);
      e += sh;
    }
    return {m, e};
  }

  function bfFromNumber(n){
    if (!Number.isFinite(n)) throw new RangeError("bfFromNumber non-finite");
    if (n === 0) return {m:0n, e:0};
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setFloat64(0, n, false);
    const hi = dv.getUint32(0, false);
    const lo = dv.getUint32(4, false);
    const sign = (hi>>>31) ? -1n : 1n;
    const exp = (hi>>>20) & 0x7ff;
    const fracHi = hi & 0xFFFFF;

    let mant = (BigInt(fracHi) << 32n) | BigInt(lo);
    let e2;
    if (exp === 0){
      e2 = -1074; // subnormal
    } else {
      mant = (1n<<52n) | mant;
      e2 = exp - 1023 - 52;
    }
    return bfNorm({m: sign*mant, e: e2});
  }

  function bfAdd(a,b){
    if (a.m===0n) return b;
    if (b.m===0n) return a;
    let am=a.m, ae=a.e|0, bm=b.m, be=b.e|0;
    if (ae > be){
      const sh = ae - be;
      if (sh > 4000) return a;
      bm = bm >> BigInt(sh);
      return bfNorm({m: am + bm, e: ae});
    } else if (be > ae){
      const sh = be - ae;
      if (sh > 4000) return b;
      am = am >> BigInt(sh);
      return bfNorm({m: am + bm, e: be});
    } else {
      return bfNorm({m: am + bm, e: ae});
    }
  }

  function bfMul(a,b){
    if (a.m===0n || b.m===0n) return {m:0n,e:0};
    return bfNorm({m: a.m*b.m, e: (a.e|0)+(b.e|0)});
  }

  function bfToFixed(a, bits){
    bits = bits|0;
    if (a.m===0n) return 0n;
    const sh = (a.e|0) + bits;
    if (sh >= 0) return a.m << BigInt(sh);
    const rsh = BigInt(-sh);
    const half = 1n << (rsh-1n);
    return (a.m + (a.m>=0n?half:-half)) >> rsh;
  }

  function bfToNumberApprox(a){
    if (a.m===0n) return 0.0;
    const m = a.m;
    const e = a.e|0;
    const abs = (m<0n)?-m:m;
    const bl = abs.toString(2).length;
    const take = Math.min(53, bl);
    const sh = bl - take;
    const top = (sh>0) ? (m >> BigInt(sh)) : m;
    return Number(top) * Math.pow(2, e + sh);
  }

  const $ = (id) => document.getElementById(id);

  const canvas = $("c");
  if (canvas) canvas.style.touchAction = "none";
  const hud = $("hud");
  const errBox = $("errBox");

  const modeEl = $("mode");
  const resEl = $("res");
  const stepEl = $("step");
  const iterEl = $("iterCap");
  const bitsEl = $("bits");
  const autoBitsEl = $("autoBits");
  const previewEl = $("preview");
  const autoSettleEl = $("autoSettle");
  const hqBtn = $("hqBtn");
  const saveBtn = $("saveBtn");
  const deepBtn = $("deepBtn"); // may be missing in simplified UI
  const deepAlwaysEl = $("deepAlways");
  const deepBadge = document.getElementById("deepBadge");
  const toastEl = document.getElementById("toast");
  const followBtn = $("followBtn");
  const zoomSpeedEl = $("zoomSpeed");
  const zoomSpeedValEl = $("zoomSpeedVal");
const resetBtn = $("resetBtn");

  function goHome(){
    resize(false);
    // Standard Mandelbrot home view
    centerXBF = bfFromNumber(-0.5);
    centerYBF = bfFromNumber(0.0);
    if (!initialScale) initialScale = 3.5 / (W || 1200);
    scaleBF   = bfFromNumber(initialScale);
    // Keep float in sync (for UI heuristics)
    centerX = -0.5;
    centerY =  0.0;
    scaleF  = initialScale;

    // Stop any in-flight HQ/follow timers
    try{ if (followTimer) { clearTimeout(followTimer); followTimer=null; } }catch(e){}
    requestRender("home", {preview:true});
  }

  resetBtn?.addEventListener("click", (ev) => { ev.preventDefault(); goHome(); });
  const nukeBtn = $("nukeBtn");
  const helpBtn = $("helpBtn");
  const helpOverlay = document.getElementById("helpOverlay");
  const helpClose = document.getElementById("helpClose");
  const helpDontShow = document.getElementById("helpDontShow");

  function showErr(t){
    errBox.style.display = "block";
    errBox.textContent = t;
  }

  const HELP_KEY = "mandelbrot_help_seen_v9_2";

  function showHelp(force){
    if (!helpOverlay) return;
    helpOverlay.style.display = "block";
    helpOverlay.setAttribute("aria-hidden","false");
    if (force) {
      // keep
    }
  }
  function hideHelp(){
    if (!helpOverlay) return;
    helpOverlay.style.display = "none";
    helpOverlay.setAttribute("aria-hidden","true");
  }
  function markHelpSeen(){
    try{ localStorage.setItem(HELP_KEY, "1"); }catch(e){}
  }
  function shouldShowHelp(){
    try{ return localStorage.getItem(HELP_KEY) !== "1"; }catch(e){ return true; }
  }
  function hideHelpAndMark(){
    markHelpSeen();
    hideHelp();
  }


  // If any runtime error escapes, show it.
  window.addEventListener("error", (e) => showErr("[window.error]\n" + e.message + "\n" + e.filename + ":" + e.lineno + ":" + e.colno));
  window.addEventListener("unhandledrejection", (e) => showErr("[unhandledrejection]\n" + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

  let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let cssW = 0, cssH = 0;
  let W = 0, H = 0;

  // view parameters (center in float64 for UI; also fixed-point for UltraDeep)
  let centerX = -0.5;
  let centerY = 0.0;
  let initialScale = 0;      // float64 (complex per pixel)
  let scaleF = 0;            // float64

  // DeepNav BigFloat camera (prevents "depth ceiling" where Number stops changing)
  // DeepNav turns 'active' when float64 precision becomes useless.
  // Trigger earlier than underflow so you can keep exploring smoothly.
  const DEEPNAV_TRIGGER_LOG2 = 80; // smaller => earlier (recommended 60-120)
  let deepNavEnabled = false; // disabled (simplified UI)
  let deepNavActive = false;
    if (deepAlways && deepNavEnabled) deepNavActive = true;
  var deepAlways = false; // disabled (simplified UI)
  var lastDeepActive = false;
  let followEnabled = true;
  let followTimer = null;
  let panRaf = null; // throttle for deep pan preview
  let centerXBF = bfFromNumber(centerX);
  let centerYBF = bfFromNumber(centerY);
  let scaleBF   = bfFromNumber(scaleF); // per-pixel scale in BigFloat

  // UltraDeep fixed-point helpers (BigInt)
// Number -> fixed-point BigInt with arbitrary bits using IEEE-754 decomposition.
// This avoids Math.pow(2,bits) overflow when bits > ~1023.
function f2fixed(n, bits){
    if (!Number.isFinite(n)) throw new RangeError("f2fixed: non-finite");
    bits = bits|0;
    if (n === 0) return 0n;

    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setFloat64(0, n, false);

    const hi = dv.getUint32(0, false);
    const lo = dv.getUint32(4, false);

    const sign = (hi >>> 31) ? -1n : 1n;
    const exp = (hi >>> 20) & 0x7ff;
    const fracHi = hi & 0xFFFFF;

    let mant = (BigInt(fracHi) << 32n) | BigInt(lo); // 52-bit fraction (no hidden bit yet)
    let e2;
    if (exp === 0) {
      // subnormal: value = mant * 2^-1074
      e2 = -1074;
    } else {
      // normal: value = (2^52 + mant) * 2^(exp-1023-52)
      mant = (1n << 52n) | mant;
      e2 = (exp - 1023 - 52);
    }

    let shift = e2 + bits; // fixed = mant * 2^(e2+bits)
    let out;
    if (shift >= 0) {
      out = mant << BigInt(shift);
    } else {
      const rshift = BigInt(-shift);
      // round-to-nearest: add 0.5 ulp before shifting
      const half = 1n << (rshift - 1n);
      out = (mant + half) >> rshift;
    }
    return sign * out;
  }

// fixed-point BigInt -> Number (only safe for moderate bits; used for debug only)
function fixed2f(v, bits){
    bits = bits|0;
    if (bits > 1023) {
      // Avoid Infinity; best-effort downshift for debug
      const sh = bits - 1023;
      v = v >> BigInt(sh);
      bits = 1023;
    }

      return Number(v) / Math.pow(2, bits);
  }

  // Workers
  const workerCount = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 8));
  const workers = [];
  let workerOK = true;
  try{
    for (let i = 0; i < workerCount; i++) {
      const w = new Worker("./worker.js?v=v7_" + Date.now().toString(36));
      w.onerror = (e)=>{ workerOK = false; showErr("[Worker error]\n" + (e.message||"worker failed")); };
      workers.push(w);
    }
  }catch(e){
    workerOK = false;
    showErr("[Worker init failed]\n" + (e.stack || e.message || e));
  }

  function resize(force=false){
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cssW = Math.max(1, Math.floor(window.innerWidth));
    cssH = Math.max(1, Math.floor(window.innerHeight));
    const r = parseFloat(resEl?.value || "0.70");
    const internal = Math.max(0.30, Math.min(1.0, r));
    const targetW = Math.max(1, Math.floor(cssW * dpr * internal));
    const targetH = Math.max(1, Math.floor(cssH * dpr * internal));
    if (!force && targetW === W && targetH === H) return;
    W = targetW; H = targetH;
    canvas.width = W; canvas.height = H;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    if (!initialScale) {
      initialScale = 3.5 / W;
      scaleF = initialScale;
      scaleBF = bfFromNumber(scaleF);
      centerXBF = bfFromNumber(centerX);
      centerYBF = bfFromNumber(centerY);
    }
  }
  window.addEventListener("resize", () => { resize(true); requestRender("resize"); }, { passive:true });

  // Iteration heuristic
  function itersForScale(scale){
    // scale is per-pixel complex scale
    let lnMag = 0;
    if (deepNavActive || !Number.isFinite(scale) || scale === 0){
      const absM = (scaleBF.m < 0n) ? -scaleBF.m : scaleBF.m;
      const mBits = absM === 0n ? 0 : absM.toString(2).length;
      const log2Scale = (mBits ? (mBits - 1) : -999999) + (scaleBF.e|0);
      lnMag = Math.log(Math.max(1e-300, initialScale)) - (Math.LN2 * log2Scale);
      lnMag = Math.max(0, lnMag);
    } else {
      const mag = initialScale / scale;
      lnMag = Math.log(Math.max(1, mag));
    }
    const base = 240 + Math.floor(70 * lnMag);
    const cap = Math.max(150, Math.min(30000, parseInt(iterEl?.value || "1400", 10)));
    return Math.max(150, Math.min(cap, base));
  }


  // Interaction
  let isDragging = false;
  let activePid = null;
  let downX = 0, downY = 0, moved = false, downT = 0;
  let lastX = 0, lastY = 0;
  let isMouseDragging = false;
  let mouseButtonMask = 0;
  let renderToken = 0;
  // HQ sequence control (so you can keep exploring after a HQ render)
  let hqActive = false;
  let hqTimers = [];
  let hqPrevStep = null;
  let hqPrevRes = null;
  function hqClearTimers(){
    for (const t of hqTimers) clearTimeout(t);
    hqTimers = [];
  }
  function hqAbort(restore=true){
    if (!hqActive) return;
    hqClearTimers();
    if (restore) {
      if (hqPrevStep != null && stepEl) stepEl.value = String(hqPrevStep);
      if (hqPrevRes != null && resEl) resEl.value = String(hqPrevRes);
      resize(true);
    }
    hqActive = false;
  }
  function hqOnUserInput(){
    // Called on wheel/drag/etc. Stops future HQ passes and restores interactive settings.
    if (!hqActive) return;
    hqAbort(true);
  }

  let debounce = 0;
  let settleTimer = 0;

  function canvasXY(ev){
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (W / rect.width);
    const y = (ev.clientY - rect.top) * (H / rect.height);
    return {x,y};
  }
  function pixelToComplex(px, py){
    return {
      x: centerX + (px - W*0.5) * scaleF,
      y: centerY + (py - H*0.5) * scaleF
    };
  }

  function schedule(reason){
    clearTimeout(debounce);
    debounce = setTimeout(() => { if (!deepNavActive) requestRender(reason, { preview:true }); else updateHUD("DeepNav active (press P or HQ)", 0, 0, 0, 0, 0); }, 35);
    if (autoSettleEl?.checked) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { if (!deepNavActive) requestRender("settle", { preview:false }); }, 220);
    }
  }

  canvas.addEventListener("pointerdown", (ev) => {
    // Mouse drag uses dedicated mouse events (more reliable across browsers)
    if (ev.pointerType === "mouse") return;
    ev.preventDefault();
    if (helpOverlay && helpOverlay.style.display==="block") hideHelpAndMark();
    hqOnUserInput();
    // Drag start: allow LEFT button or MIDDLE (wheel press) for mouse.
    if (ev.pointerType === "mouse") {
      const ok = (ev.button === 0 || ev.button === 1 || (ev.buttons & 1) || (ev.buttons & 4));
      if (!ok) return;
    }
    canvas.setPointerCapture(ev.pointerId);
    isDragging = true;
    activePid = ev.pointerId;
    moved = false;
    downT = performance.now();
    const p = canvasXY(ev);
    downX = p.x; downY = p.y;
    lastX = p.x; lastY = p.y;
  }, { passive:false });

  canvas.addEventListener("pointermove", (ev) => {
    if (!isDragging) return;
    if (activePid !== null && ev.pointerId !== activePid) return;
    // Some environments keep firing move after release; stop immediately.
    if (ev.pointerType === "mouse" && ev.buttons === 0) { isDragging = false; activePid = null; return; }
    ev.preventDefault();
    const p = canvasXY(ev);
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    if (!moved) {
      const ddx = (p.x - downX), ddy = (p.y - downY);
      if (ddx*ddx + ddy*ddy > 64) moved = true; // 8px
    }
    lastX = p.x; lastY = p.y;
    centerX -= dx * scaleF;
    centerY -= dy * scaleF;
    // BigFloat pan: centerBF -= dPix * scaleBF
    centerXBF = bfAdd(centerXBF, bfMul(bfFromNumber(-dx), scaleBF));
    centerYBF = bfAdd(centerYBF, bfMul(bfFromNumber(-dy), scaleBF));
    if (deepNavActive){
      centerX = bfToNumberApprox(centerXBF);
      centerY = bfToNumberApprox(centerYBF);
      updateHUD("DeepNav active (log2>|"+DEEPNAV_TRIGGER_LOG2+"|)  Follow/HQ", 0, 0, 0, 0, 0);
      requestDeepPanPreview("pan");
      return;
    }
    schedule("pan");
  }, { passive:false });

  canvas.addEventListener("pointerup", (ev) => {
    ev.preventDefault();
    isDragging = false;
    activePid = null;
    // CAD-style: single click does nothing (prevents accidental recenters).
    // Recenter is on double-click.
  }, { passive:false });
  canvas.addEventListener("pointercancel", (ev) => { isDragging=false; activePid=null; }, { passive:true });

  canvas.addEventListener("lostpointercapture", (ev) => { isDragging=false; activePid=null; }, { passive:true });
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("auxclick", (ev) => ev.preventDefault());

  // Mouse drag fallback (LEFT or MIDDLE / wheel-press). More reliable than pointer events for mouse.
  function mouseDownOk(ev){
    // button: 0=left, 1=middle
    return (ev.button === 0 || ev.button === 1);
  }

  canvas.addEventListener("mousedown", (ev) => {
    if (!mouseDownOk(ev)) return;
    ev.preventDefault();
    if (helpOverlay && helpOverlay.style.display==="block") hideHelpAndMark();
    hqOnUserInput();

    // stop browser autoscroll on middle click
    mouseButtonMask = (ev.button === 0) ? 1 : 4;

    isMouseDragging = true;
    moved = false;
    downT = performance.now();

    const p = canvasXY(ev);
    downX = p.x; downY = p.y;
    lastX = p.x; lastY = p.y;

    // capture mouse outside canvas while dragging
    window.addEventListener("mousemove", onMouseMove, { passive:false });
    window.addEventListener("mouseup", onMouseUp, { passive:false, once:true });
  }, { passive:false });

  function onMouseMove(ev){
    if (!isMouseDragging) return;
    // If button released (some environments), stop immediately
    if ((ev.buttons & mouseButtonMask) === 0) { onMouseUp(ev); return; }

    ev.preventDefault();
    const p = canvasXY(ev);
    const dx = p.x - lastX;
    const dy = p.y - lastY;

    if (!moved) {
      const ddx = (p.x - downX), ddy = (p.y - downY);
      if (ddx*ddx + ddy*ddy > 64) moved = true; // 8px
    }

    lastX = p.x; lastY = p.y;

    centerX -= dx * scaleF;
    centerY -= dy * scaleF;

    centerXBF = bfAdd(centerXBF, bfMul(bfFromNumber(-dx), scaleBF));
    centerYBF = bfAdd(centerYBF, bfMul(bfFromNumber(-dy), scaleBF));

    if (deepNavActive){
      centerX = bfToNumberApprox(centerXBF);
      centerY = bfToNumberApprox(centerYBF);
      updateHUD("DeepNav active (log2>|"+DEEPNAV_TRIGGER_LOG2+"|)  Follow/HQ", 0, 0, 0, 0, 0);
      requestDeepPanPreview("pan");
      return;
    }
    schedule("pan");
  }

  function onMouseUp(ev){
    if (!isMouseDragging) return;
    ev?.preventDefault?.();
    isMouseDragging = false;
    mouseButtonMask = 0;
    window.removeEventListener("mousemove", onMouseMove, { passive:false });
    // single click does nothing (CAD style)
  }

canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (helpOverlay && helpOverlay.style.display==="block") hideHelpAndMark();
    hqOnUserInput();
    const {x:px, y:py} = canvasXY(ev);

    const base = 0.0068;
    const zspd0 = Math.max(0.01, Math.min(3.0, parseFloat(zoomSpeedEl?.value || "0.35")));
    const zspd = (ev.shiftKey ? (zspd0 * 0.25) : zspd0);
    let dyN = ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
    // 一部デバイスでdeltaが極端に大きく出るので、ズームが跳ねないように抑制
    dyN = Math.sign(dyN) * Math.min(240, Math.abs(dyN));
    const speed = base * zspd;
    const factor = Math.exp(-dyN * speed);

    const dxPix = (px - W*0.5);
    const dyPix = (py - H*0.5);

    // --- BigFloat camera (robust at extreme depth) ---
    const scaleBeforeBF = scaleBF;
    const fBF = bfFromNumber(factor);
    const scaleAfterBF = bfMul(scaleBF, fBF);
    const deltaScaleBF = bfAdd(scaleBeforeBF, {m:-scaleAfterBF.m, e:scaleAfterBF.e}); // before - after

    centerXBF = bfAdd(centerXBF, bfMul(bfFromNumber(dxPix), deltaScaleBF));
    centerYBF = bfAdd(centerYBF, bfMul(bfFromNumber(dyPix), deltaScaleBF));
    scaleBF = scaleAfterBF;

    // --- float camera (fast for normal depths) ---
    const beforeF = scaleF;
    scaleF = Math.min(10, scaleF * factor);
    centerX += dxPix * (beforeF - scaleF);
    centerY += dyPix * (beforeF - scaleF);

    // Activate DeepNav when float stops meaningfully changing (subnormal/zero range).
    const absM = (scaleBF.m < 0n) ? -scaleBF.m : scaleBF.m;
    const mBits = absM === 0n ? 0 : absM.toString(2).length;
    const log2Scale = (mBits ? (mBits - 1) : -999999) + (scaleBF.e|0);
    deepNavActive = deepNavEnabled && (scaleF === 0 || !Number.isFinite(scaleF) || log2Scale < -1080);

    if (deepNavActive){
      // keep UI in sync (approx; may show 0 for scaleF at extreme depths)
      centerX = bfToNumberApprox(centerXBF);
      centerY = bfToNumberApprox(centerYBF);
      scaleF  = bfToNumberApprox(scaleBF);
      updateHUD("DeepNav active (log2>|"+DEEPNAV_TRIGGER_LOG2+"|)  Follow/HQ", 0, 0, 0, 0, 0);
      scheduleFollowPreview("wheel");
      return;
    }

    schedule("zoom");
  }, { passive:false });

  canvas.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    if (helpOverlay && helpOverlay.style.display==="block") hideHelpAndMark();
    hqOnUserInput();
    const p = canvasXY(ev);
    // center to point
    const dxPix = (p.x - W*0.5);
    const dyPix = (p.y - H*0.5);
    centerX += dxPix * scaleF;
    centerY += dyPix * scaleF;
    centerXBF = bfAdd(centerXBF, bfMul(bfFromNumber(dxPix), scaleBF));
    centerYBF = bfAdd(centerYBF, bfMul(bfFromNumber(dyPix), scaleBF));
    // zoom in a bit
    const factor = 0.5;
    scaleF *= factor;
    scaleBF = bfMul(scaleBF, bfFromNumber(factor));
    if (deepNavActive) scheduleFollowPreview("dbl");
    else schedule("dbl");
  }, { passive:false });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "h" || ev.key === "H") { ev.preventDefault(); goHome(); return; }

    if (ev.key && ev.key.toLowerCase() === "a") {
      deepAlways = !deepAlways;
      try { localStorage.setItem("deepAlways", deepAlways ? "1" : "0"); } catch(e) {}
      if (deepAlwaysEl) deepAlwaysEl.checked = deepAlways;
      if (deepNavEnabled) deepNavActive = deepAlways ? true : deepNavActive;
      updateDeepBadge?.();
      showToast?.(deepAlways ? "ALWAYS ON" : "ALWAYS OFF");
      return;
    }
    if (ev.key === "Escape") { hqAbort(true); requestRender("esc", {preview:true}); return; }
    if (ev.key.toLowerCase() === "r") doReset();
    if (ev.key.toLowerCase() === "s") savePNG();
    if (ev.key === "?" || ev.key.toLowerCase() === "h") {
      if (helpOverlay && helpOverlay.style.display==="block") hideHelp(); else showHelp(true);
    }
  }, { passive:true });

  function doReset(){
    centerX = -0.5; centerY = 0.0;
    scaleF = initialScale || (3.5 / Math.max(1, W));
    centerXBF = bfFromNumber(centerX);
    centerYBF = bfFromNumber(centerY);
    scaleBF = bfFromNumber(scaleF);
    deepNavActive = false;
    if (deepAlways && deepNavEnabled) deepNavActive = true;
    requestRender("reset", { preview:false });
  }

  async function savePNG(){
    try{
      const mode = (modeEl?.value || "ultradeep");
      const bits = (bitsEl?.value || "").trim();
      const iters = (iterEl?.value || "").trim();
      const step = (stepEl?.value || "").trim();
      const res = (resEl?.value || "").trim();
      const stamp = new Date().toISOString().replace(/[:.]/g,"-");
      const name = `mandelbrot_${mode}_bits${bits}_it${iters}_step${step}_res${res}_${stamp}.png`;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("toBlob failed");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
    }catch(e){
      showErr("[savePNG]\n" + ((e && (e.stack || e.message)) || e));
    }
  }

  resetBtn?.addEventListener("click", doReset);
  nukeBtn?.addEventListener("click", () => { location.href = "./reset.html"; });

  saveBtn?.addEventListener("click", () => { savePNG(); });
  // restore DeepNav Always state
  try { deepAlways = (localStorage.getItem("deepAlways") ?? "1") === "1"; } catch(e) {}
  if (deepAlwaysEl) deepAlwaysEl.checked = deepAlways;
  deepAlwaysEl?.addEventListener("change", () => {
    deepAlways = !!deepAlwaysEl.checked;
    try { localStorage.setItem("deepAlways", deepAlways ? "1" : "0"); } catch(e) {}
    // If always-on, force active immediately (but keep enabled respected)
    if (deepAlways && deepNavEnabled) deepNavActive = true;
    updateDeepBadge();
  });

  deepBtn?.addEventListener("click", () => {
    deepNavEnabled = !deepNavEnabled;
    if (deepBtn) deepBtn.textContent = deepNavEnabled ? "DeepNav" : "DeepNav OFF";
    updateHUD("toggle DeepNav (enabled)", 0, 0, 0, 0, 0);
  });


  hqBtn?.addEventListener("click", () => {
    // One-shot HQ render: no progressive passes (prevents "keeps changing" feeling).
    hqAbort(false);
    hqActive = true;
    hqClearTimers();

    // remember interactive settings
    hqPrevRes = resEl ? parseFloat(resEl.value || "0.70") : 0.70;
    hqPrevStep = stepEl ? parseInt(stepEl.value || "2", 10) : 2;

    // set HQ settings
    if (resEl) resEl.value = "1.00";
    if (stepEl) stepEl.value = "1";
    resize(true);

    requestRender("HQ(one-shot)", {
      preview:false,
      forceRes: 1.0,
      forceStep: 1,
      // restore interactive controls after render completes (image stays as-is until next input)
      onDone: () => {
        if (resEl) resEl.value = String(hqPrevRes ?? 0.70);
        if (stepEl) stepEl.value = String(hqPrevStep ?? 2);
        hqActive = false;
      }
    });
  });

  // Rendering
  function clear(){
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0,0,W,H);
  }

  function updateHUD(reason, ms, iters, bitsUsed, step, internal){
    const absM = (scaleBF.m < 0n) ? -scaleBF.m : scaleBF.m;
    const mBits = absM === 0n ? 0 : absM.toString(2).length;
    const log2Scale = (mBits ? (mBits - 1) : -999999) + (scaleBF.e|0);
    const mag = initialScale / scaleF;
    hud.textContent =
`center = (${centerX.toPrecision(16)}, ${centerY.toPrecision(16)})
scale  = ${scaleF.toExponential(6)} (magnification ≈ ${mag.toExponential(3)}x)
scaleBF= log2=${log2Scale}  e2=${scaleBF.e}  mBits~${mBits}
DeepNav= ${deepNavEnabled ? "ON" : "OFF"}  active=${deepNavActive ? "ON" : "OFF"}
mode   = ${modeEl?.value || "ultradeep"}   workers=${workerCount} (ok=${workerOK})
iters  = ${iters}   bits=${bitsUsed}   step=${step}   internalRes=${internal}
last   = ${ms|0} ms   ${reason||""}`;
    updateDeepBadge();
  }

  function showToast(msg){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t || 0);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 900);
  }

  function updateDeepBadge(){
    if (!deepBadge) return;
    // enabled=DeepNav機能のON/OFF, active=現在BigFloat優先で動いているか
    const enabled = !!deepNavEnabled;
    const active = !!deepNavActive;
    deepBadge.classList.remove("on","off","standby");
    if (!enabled){
      deepBadge.classList.add("off");
      deepBadge.textContent = "DEEPNAV OFF";
    } else if (active){
      deepBadge.classList.add("on");
      deepBadge.textContent = "DEEPNAV ACTIVE";
    } else {
      deepBadge.classList.add("standby");
      deepBadge.textContent = "DEEPNAV STANDBY";
    }
    // toast on transition to active
    if (active && !lastDeepActive) showToast("DEEPNAV ACTIVE");
    lastDeepActive = active;
  }



  function renderStandard(token, opts){
    const start = performance.now();
    let internal = parseFloat(resEl?.value || "0.70");
    if (opts && Number.isFinite(opts.forceRes)) internal = Math.max(0.10, Math.min(1.0, opts.forceRes));
    const preview = !!(opts && opts.preview) && (previewEl?.checked ?? true);
    const baseStep = parseInt(stepEl?.value || "2", 10);
    let step = ((opts && opts.hq) ? 1 : (preview ? Math.min(16, Math.max(6, baseStep*3)) : baseStep));
    if (opts && Number.isFinite(opts.forceStep)) step = Math.max(1, opts.forceStep|0);
    let iters = itersForScale(scaleF);
    if (opts && Number.isFinite(opts.forceIterCap)) iters = Math.min(iters, opts.forceIterCap|0);

    const img = ctx.createImageData(W, H);
    const data = img.data;
    const xmin = centerX - (W*0.5)*scaleF;
    const ymin = centerY - (H*0.5)*scaleF;

    function mandel(cx, cy){
      let x=0, y=0, x2=0, y2=0;
      let i=0;
      while (i<iters && x2+y2<=4){
        y = 2*x*y + cy;
        x = x2 - y2 + cx;
        x2 = x*x; y2=y*y;
        i++;
      }
      return i;
    }
    function color(i){
      if (i>=iters) return [0,0,0,255];
      const t = i/iters;
      const a = 0.5+0.5*Math.sin(6.28318*(t*3.0 + 0.00));
      const b = 0.5+0.5*Math.sin(6.28318*(t*3.0 + 0.33));
      const c = 0.5+0.5*Math.sin(6.28318*(t*3.0 + 0.66));
      return [(a*255)|0,(b*255)|0,(c*255)|0,255];
    }

    for (let y=0; y<H; y+=step){
      const cy = ymin + y*scaleF;
      for (let x=0; x<W; x+=step){
        const cx = xmin + x*scaleF;
        const it = mandel(cx, cy);
        const [r,g,b,a] = color(it);
        const yMax = Math.min(H, y+step);
        const xMax = Math.min(W, x+step);
        for (let yy=y; yy<yMax; yy++){
          let idx = (yy*W + x)*4;
          for (let xx=x; xx<xMax; xx++){
            data[idx]=r; data[idx+1]=g; data[idx+2]=b; data[idx+3]=a;
            idx+=4;
          }
        }
      }
    }
    if (token !== renderToken) return;
    ctx.putImageData(img, 0, 0);
    updateHUD("standard "+(opts?.preview?"preview":"full"), performance.now()-start, iters, 0, step, internal.toFixed(2));
  }

  function renderUltraDeep(token, opts){
    const start = performance.now();
    const preview = !!(opts && opts.preview) && (previewEl?.checked ?? true);
    const baseBits = parseInt(bitsEl?.value || "512", 10) | 0;
    let iters = itersForScale(scaleF);
    if (opts && Number.isFinite(opts.forceIterCap)) iters = Math.min(iters, opts.forceIterCap|0);
    let internal = parseFloat(resEl?.value || "0.70");
    if (opts && Number.isFinite(opts.forceRes)) internal = Math.max(0.10, Math.min(1.0, opts.forceRes));

    // preview bits cap for speed
    const bitsUsed = (preview ? Math.min(baseBits, 160) : baseBits) | 0;
    const sh = baseBits - bitsUsed;

    // choose step
    const baseStep = parseInt(stepEl?.value || "2", 10);
    let step = ((opts && opts.hq) ? 1 : (preview ? Math.min(16, Math.max(6, baseStep*3)) : baseStep));
    if (opts && Number.isFinite(opts.forceStep)) step = Math.max(1, opts.forceStep|0);

    // fixed-point mapping
    // Use baseBits for center+scale mapping then downshift to bitsUsed to preserve location
    const centerXFix = bfToFixed(centerXBF, baseBits);
    const centerYFix = bfToFixed(centerYBF, baseBits);
    const scaleFix = bfToFixed(scaleBF, baseBits);

    const halfW = BigInt(Math.floor(W/2));
    const halfH = BigInt(Math.floor(H/2));
    let xmin = centerXFix - (halfW * scaleFix);
    let ymin = centerYFix - (halfH * scaleFix);

    let scale = scaleFix;
    if (sh > 0) {
      xmin >>= BigInt(sh);
      ymin >>= BigInt(sh);
      scale >>= BigInt(sh);
    }

    if (!workerOK || workers.length === 0) {
      // fallback
      renderStandard(token, opts);
      return;
    }

    clear();
    const strip = Math.max(24, Math.floor(H / (workerCount * 5)));
    const jobs = [];
    for (let y0=0; y0<H; y0+=strip){
      jobs.push({y0, rows: Math.min(strip, H-y0)});
    }

    let done = 0;
    const onMsg = (ev) => {
      const m = ev.data;
      if (!m || m.token !== token || m.type !== "strip") return;
      const data = new Uint8ClampedArray(m.buffer);
      // 防御：キャッシュ混線/サイズ変更などで data 長が合わない場合は捨てる
      const rowsFromData = Math.floor(data.length / (W * 4));
      if (rowsFromData <= 0 || rowsFromData * W * 4 !== data.length) return;
      if (m.startY + rowsFromData > H) return;

      const img = new ImageData(data, W, rowsFromData);
      ctx.putImageData(img, 0, m.startY);
done++;
      if (done >= jobs.length) {
        for (const w of workers) w.removeEventListener("message", onMsg);
        if (token !== renderToken) return;
        updateHUD("ultradeep "+(preview?"preview":"full"), performance.now()-start, iters, bitsUsed, step, internal.toFixed(2));
        try{ if (opts && typeof opts.onDone === "function") opts.onDone(); }catch(e){}

      }
    };
    for (const w of workers) w.addEventListener("message", onMsg);

    for (let i=0;i<jobs.length;i++){
      const w = workers[i % workerCount];
      const j = jobs[i];
      w.postMessage({
        type:"job",
        token,
        W,
        startY: j.y0,
        rows: j.rows,
        step,
        maxIter: iters,
        bits: bitsUsed,
        xmin,
        ymin,
        scale
      });
    }
  }

  
  function scheduleFollowPreview(reason){
    if (!deepNavActive || !followEnabled) return;
    if (followTimer) clearTimeout(followTimer);
    // デバウンスして、操作が落ち着いたら低負荷プレビューを1回だけ描画
    followTimer = setTimeout(() => {
      followTimer = null;
      requestRender("follow:" + (reason||""), {
        preview: false,
        forceRes: 0.40,
        forceStep: 24,
        forceIterCap: 420
      });
    }, 60);
  }

  function requestDeepPanPreview(reason){
    if (!deepNavActive) return;
    if (panRaf) return;
    panRaf = requestAnimationFrame(() => {
      panRaf = null;
      requestRender("pan:" + (reason||""), {
        preview: false,
        forceRes: 0.55,
        forceStep: 10,
        forceIterCap: 520
      });
    });
  }


function requestRender(reason="", opts={}){
    resize(false);
    const token = ++renderToken;
    try{
      if ((modeEl?.value || "ultradeep") === "standard") {
        renderStandard(token, opts);
      } else {
        // autoBits: keep image stable at deep zoom
        if (autoBitsEl?.checked) {
          // heuristic: bits ~ 120 + log2(magnification)*24 (clamped)
          const mag = Math.max(1, initialScale / scaleF);
          const need = Math.floor(120 + Math.log2(mag) * 24);
          const clamped = Math.max(96, Math.min(8192, need));
          bitsEl.value = String(Math.ceil(clamped / 64) * 64);
        }
        renderUltraDeep(token, opts);
      }
    }catch(e){
      showErr("[render exception]\n" + (e.stack || e.message || e));
    }
  }

  modeEl?.addEventListener("change", () => requestRender("mode", {preview:false}));
  resEl?.addEventListener("input", () => { resize(true); requestRender("res", {preview:true}); });
  stepEl?.addEventListener("change", () => requestRender("step", {preview:false}));
  iterEl?.addEventListener("change", () => requestRender("iters", {preview:false}));
  bitsEl?.addEventListener("change", () => requestRender("bits", {preview:false}));
  previewEl?.addEventListener("change", () => requestRender("preview", {preview:false}));
  autoBitsEl?.addEventListener("change", () => requestRender("autoBits", {preview:false}));
  autoSettleEl?.addEventListener("change", () => requestRender("autoSettle", {preview:false}));

  // First render
  resize(true);
  requestRender("boot", {preview:false});
})();
function updateZoomSpeedLabel(){ /* noop */ }
