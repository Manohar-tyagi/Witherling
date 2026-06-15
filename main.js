(function () {
  const canvas = document.getElementById('flowerCanvas');
  const ctx = canvas.getContext('2d');
  const landing = document.getElementById('landing');
  const revealBtn = document.getElementById('revealBtn');
  const scrollContent = document.getElementById('scrollContent');

  let W, H;
  let mouseX = -9999, mouseY = -9999;
  let smMouseX = -9999, smMouseY = -9999;
  let isRevealed = false;
  let tulipsHidden = false;

  const NUM_FLOWERS = 3500;
  const REPULSION_RADIUS = 200;
  const LERP_SPEED = 0.05;
  const FOCAL = 900;
  const CACHE_SIZE = 100;

  const typeDefs = [
    { p: '#d05080', b: '#fce4ec', s: '#5a7a4a' },
    { p: '#e06090', b: '#fde8f0', s: '#6d8a5d' },
    { p: '#c84070', b: '#fce0ec', s: '#4e6e3e' },
    { p: '#e88870', b: '#fdf0ea', s: '#7a9a6a' },
    { p: '#d07060', b: '#fce8e0', s: '#6a8a5a' },
    { p: '#f0a080', b: '#fef2ec', s: '#88a878' },
    { p: '#9070b8', b: '#f0e8f8', s: '#5a7a4a' },
    { p: '#a080c8', b: '#f2ecfa', s: '#6d8a5d' },
    { p: '#8060a8', b: '#ece4f4', s: '#4e6e3e' },
    { p: '#f8e8d8', b: '#fffcf8', s: '#7e8e72' },
    { p: '#f5dcc8', b: '#fefaf4', s: '#8aaa7a' },
    { p: '#e8c870', b: '#fef8e0', s: '#90b080' },
    { p: '#f0b850', b: '#fef4d0', s: '#88a878' },
    { p: '#e0b060', b: '#fef4d8', s: '#7a9a6a' },
    { p: '#f0a0b8', b: '#fef0f4', s: '#88a878' },
    { p: '#e880a0', b: '#fde8f0', s: '#6a8a5a' },
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lighten(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + pct);
    const g = Math.min(255, ((n >> 8) & 0xff) + pct);
    const b = Math.min(255, (n & 0xff) + pct);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function darken(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - pct);
    const g = Math.max(0, ((n >> 8) & 0xff) - pct);
    const b = Math.max(0, (n & 0xff) - pct);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function createCachedTulip(petal, blush, stem) {
    const c = document.createElement('canvas');
    c.width = CACHE_SIZE;
    c.height = CACHE_SIZE;
    const cx = c.getContext('2d');
    const hc = CACHE_SIZE / 2;

    const stemG = cx.createLinearGradient(hc - 5, hc + 5, hc + 5, hc + 5);
    stemG.addColorStop(0, darken(stem, 20));
    stemG.addColorStop(0.25, stem);
    stemG.addColorStop(0.75, stem);
    stemG.addColorStop(1, darken(stem, 20));

    cx.beginPath();
    cx.moveTo(hc - 3.5, hc + 5);
    cx.quadraticCurveTo(hc - 1.5, hc + 9, hc, hc + 12);
    cx.lineTo(hc + 3.5, hc + 12);
    cx.quadraticCurveTo(hc + 4.5, hc + 9, hc + 3.5, hc + 5);
    cx.closePath();
    cx.fillStyle = stemG;
    cx.fill();

    cx.shadowColor = 'rgba(180,130,120,0.18)';
    cx.shadowBlur = 8;
    cx.shadowOffsetY = 1;

    const gLO = cx.createRadialGradient(hc - 20, hc - 14, 2, hc - 20, hc - 14, 34);
    gLO.addColorStop(0, lighten(petal, 28));
    gLO.addColorStop(0.5, petal);
    gLO.addColorStop(1, darken(petal, 10));

    cx.beginPath();
    cx.moveTo(hc, hc - 2);
    cx.bezierCurveTo(hc - 22, hc - 2, hc - 34, hc - 18, hc - 20, hc - 44);
    cx.bezierCurveTo(hc - 12, hc - 50, hc - 4, hc - 48, hc, hc - 42);
    cx.closePath();
    cx.fillStyle = gLO;
    cx.fill();

    const gRO = cx.createRadialGradient(hc + 20, hc - 14, 2, hc + 20, hc - 14, 34);
    gRO.addColorStop(0, lighten(petal, 28));
    gRO.addColorStop(0.5, petal);
    gRO.addColorStop(1, darken(petal, 10));

    cx.beginPath();
    cx.moveTo(hc, hc - 2);
    cx.bezierCurveTo(hc + 22, hc - 2, hc + 34, hc - 18, hc + 20, hc - 44);
    cx.bezierCurveTo(hc + 12, hc - 50, hc + 4, hc - 48, hc, hc - 42);
    cx.closePath();
    cx.fillStyle = gRO;
    cx.fill();

    const gCB = cx.createRadialGradient(hc, hc - 20, 0, hc, hc - 20, 24);
    gCB.addColorStop(0, lighten(petal, 18));
    gCB.addColorStop(1, darken(petal, 6));

    cx.beginPath();
    cx.moveTo(hc - 8, hc - 4);
    cx.bezierCurveTo(hc - 10, hc - 14, hc - 5, hc - 28, hc, hc - 42);
    cx.bezierCurveTo(hc + 5, hc - 28, hc + 10, hc - 14, hc + 8, hc - 4);
    cx.closePath();
    cx.fillStyle = gCB;
    cx.fill();

    cx.shadowColor = 'rgba(200,160,150,0.1)';
    cx.shadowBlur = 6;

    const gLI = cx.createRadialGradient(hc - 10, hc - 16, 0, hc - 10, hc - 16, 26);
    gLI.addColorStop(0, lighten(blush, 15));
    gLI.addColorStop(0.5, blush);
    gLI.addColorStop(1, darken(blush, 5));

    cx.beginPath();
    cx.moveTo(hc, hc - 4);
    cx.bezierCurveTo(hc - 14, hc - 6, hc - 20, hc - 20, hc - 11, hc - 38);
    cx.bezierCurveTo(hc - 6, hc - 43, hc - 2, hc - 41, hc, hc - 36);
    cx.closePath();
    cx.fillStyle = gLI;
    cx.fill();

    const gRI = cx.createRadialGradient(hc + 10, hc - 16, 0, hc + 10, hc - 16, 26);
    gRI.addColorStop(0, lighten(blush, 15));
    gRI.addColorStop(0.5, blush);
    gRI.addColorStop(1, darken(blush, 5));

    cx.beginPath();
    cx.moveTo(hc, hc - 4);
    cx.bezierCurveTo(hc + 14, hc - 6, hc + 20, hc - 20, hc + 11, hc - 38);
    cx.bezierCurveTo(hc + 6, hc - 43, hc + 2, hc - 41, hc, hc - 36);
    cx.closePath();
    cx.fillStyle = gRI;
    cx.fill();

    cx.shadowBlur = 0;
    cx.shadowOffsetY = 0;

    cx.beginPath();
    cx.moveTo(hc - 4, hc - 12);
    cx.bezierCurveTo(hc - 5, hc - 20, hc - 2, hc - 28, hc, hc - 35);
    cx.bezierCurveTo(hc + 2, hc - 28, hc + 5, hc - 20, hc + 4, hc - 12);
    cx.closePath();
    cx.fillStyle = lighten(blush, 22);
    cx.fill();

    cx.beginPath();
    cx.moveTo(hc - 6, hc - 14);
    cx.bezierCurveTo(hc - 7, hc - 22, hc - 3, hc - 30, hc, hc - 37);
    cx.bezierCurveTo(hc + 3, hc - 30, hc + 7, hc - 22, hc + 6, hc - 14);
    cx.closePath();
    cx.fillStyle = lighten(blush, 30);
    cx.fill();

    return c;
  }

  const cachedTypes = typeDefs.map(t => createCachedTulip(t.p, t.b, t.s));

  const psx = new Float64Array(NUM_FLOWERS);
  const psy = new Float64Array(NUM_FLOWERS);
  const psc = new Float64Array(NUM_FLOWERS);
  const pz = new Float64Array(NUM_FLOWERS);
  const visible = [];

  function initFlowers() {
    const fs = new Array(NUM_FLOWERS);
    for (let i = 0; i < NUM_FLOWERS; i++) {
      const bx = (Math.random() - 0.5) * 1600;
      const by = (Math.random() - 0.5) * 1200;
      const bz = Math.random() * 800 - 50;
      fs[i] = {
        baseX: bx, baseY: by, z: bz,
        smoothedX: bx, smoothedY: by,
        targetX: bx, targetY: by,
        typeIdx: Math.floor(Math.random() * typeDefs.length),
        size: 0.6 + Math.random() * 1.0,
        baseRotation: (Math.random() - 0.5) * 0.15,
        swaySpeed: 0.2 + Math.random() * 0.5,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmount: 0.01 + Math.random() * 0.03,
        swayAmp: 1.5 + Math.random() * 2.5
      };
    }
    return fs;
  }

  let flowers = initFlowers();

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  }

  window.addEventListener('resize', resize);

  function updatePhysics() {
    if (tulipsHidden) return;

    const t = Date.now() * 0.001;

    for (let i = 0; i < NUM_FLOWERS; i++) {
      const f = flowers[i];
      let tx = f.baseX;
      let ty = f.baseY;

      tx += Math.sin(t * f.swaySpeed + f.swayPhase) * f.swayAmp;
      ty += Math.cos(t * f.swaySpeed * 0.7 + f.swayPhase * 0.9) * f.swayAmp;

      if (!isRevealed) {
        const sc = FOCAL / (FOCAL + f.z);
        const px = f.smoothedX * sc + W / 2;
        const py = f.smoothedY * sc + H / 2;
        const dx = px - smMouseX;
        const dy = py - smMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSION_RADIUS && dist > 0.5) {
          const force = (REPULSION_RADIUS - dist) / REPULSION_RADIUS;
          const push = force * force * 80;
          tx += (dx / dist) * push;
          ty += (dy / dist) * push;
        }
      }

      f.targetX = tx;
      f.targetY = ty;
      f.smoothedX = lerp(f.smoothedX, f.targetX, LERP_SPEED);
      f.smoothedY = lerp(f.smoothedY, f.targetY, LERP_SPEED);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (tulipsHidden) return;

    const t = Date.now() * 0.001;
    const hc = CACHE_SIZE / 2;
    const focal = FOCAL;
    const hw = W / 2;
    const hh = H / 2;

    for (let i = 0; i < NUM_FLOWERS; i++) {
      const f = flowers[i];
      const sc = focal / (focal + f.z);
      psx[i] = f.smoothedX * sc + hw;
      psy[i] = f.smoothedY * sc + hh;
      psc[i] = sc * f.size;
      pz[i] = f.z;
    }

    visible.length = 0;
    for (let i = 0; i < NUM_FLOWERS; i++) {
      if (psc[i] >= 0.015 && psx[i] > -hc && psx[i] < W + hc && psy[i] > -hc && psy[i] < H + hc) {
        visible.push(i);
      }
    }

    visible.sort((a, b) => pz[a] - pz[b]);

    for (let oi = 0, len = visible.length; oi < len; oi++) {
      const i = visible[oi];
      const f = flowers[i];

      const swayRot = Math.sin(t * f.swaySpeed + f.swayPhase) * f.swayAmount;
      const rot = f.baseRotation + swayRot;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const sc = psc[i];
      const a = sc * cos;
      const b = sc * sin;
      const c = -sc * sin;
      const d = sc * cos;

      ctx.setTransform(a, b, c, d, psx[i], psy[i]);
      ctx.drawImage(cachedTypes[f.typeIdx], -hc, -hc);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function loop() {
    smMouseX = lerp(smMouseX, mouseX, 0.07);
    smMouseY = lerp(smMouseY, mouseY, 0.07);
    updatePhysics();
    render();
    requestAnimationFrame(loop);
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  document.addEventListener('touchmove', function (e) {
    const t = e.touches[0];
    mouseX = t.clientX;
    mouseY = t.clientY;
  }, { passive: true });

  revealBtn.addEventListener('click', function () {
    if (tulipsHidden || isRevealed) return;
    revealBtn.style.pointerEvents = 'none';
    tulipsHidden = true;
    isRevealed = true;
    landing.classList.remove('frame-held');
    landing.classList.add('hidden');
    scrollContent.classList.add('visible');
    document.body.classList.add('scrollable');
    setupIntersectionObserver();
  });

  let observer = null;

  function setupIntersectionObserver() {
    if (observer) observer.disconnect();
    const sections = document.querySelectorAll('.scroll-section');
    observer = new IntersectionObserver(function (entries) {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      }
    }, { threshold: 0.12 });
    for (const s of sections) {
      observer.observe(s);
    }
  }

  resize();
  loop();
})();
