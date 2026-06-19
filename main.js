import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const threeCanvas = document.getElementById('threeCanvas');
const tulipCanvas = document.getElementById('tulipCanvas');
const landing = document.getElementById('landing');
const scrollContainer = document.getElementById('scrollContainer');
const revealBtn = document.getElementById('revealBtn');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const particleOverlay = document.getElementById('particleOverlay');
const scrollProgress = document.getElementById('scrollProgress');
const scrollProgressFill = document.getElementById('scrollProgressFill');
const cursorGlow = document.getElementById('cursorGlow');

let scene, camera, renderer, model, modelGroup;
let outerPetals = [];
let middlePetals = [];
let innerPetals = [];
let otherMeshes = [];
let clock = new THREE.Clock();
let noClickCount = 0;
let isTransformed = false;
let isRevealed = false;
let isLanding = true;
let holdTimeout = null;
let particleSystem = null;
let particleVelocities = [];
let particleLife = [];
let isParticleActive = false;
let baseScale = 1;
let starParticles = null;
let nebulaSprites = [];
let emberMotes = null;
let emberData = null;
let mercuryBlobs = [];
let silkRibbons = [];
let mouseWorld = new THREE.Vector3(); // current mouse position projected to flower surface
let finaleGlowLight = null;
// blurAmount: 1 = fully soft/out-of-focus (flower emerging from darkness
// at the top of the page), 0 = tack sharp. Scroll-driven; see setupScrollAnimation.
// Applied as a CSS filter on the 3D canvases rather than a postprocessing
// pass, since the classic three.js BokehShader hardcodes opaque alpha
// output and would have broken this page's layered transparent-canvas design.
let focusState = { blurAmount: 1 };

// Spherical orbit camera state, driven by the scroll timeline and applied
// every frame in animate(). Polar angle is measured from level: polar = 0
// means level with the flower (looking at it horizontally), polar = PI/2
// means directly overhead looking straight down. Using an explicit orbit
// instead of independent x/y/z position tweens means the camera can swing
// all the way to a top-down shot while always staying aimed at the flower.
let cameraOrbit = { radius: 9.5, polar: 0, azimuth: 0, targetY: -0.8 };
let orbitActive = false;

const initialRotations = new Map();

const FOCAL = 900;
const NUM_FLOWERS = 3500;
const SPRITE_SIZE = 120;
const COLOR_PALETTES = [
  { o: ['#8B2A2A','#6B1A1A','#4A0E0E','#A84A4A'], m: ['#A84A4A','#8B2A2A','#6B1A1A','#C86A6A'], i: ['#C86A6A','#A84A4A','#8B2A2A','#E08A8A'], c: ['#1A0808','#2A0E0E','#3A1414'] },
  { o: ['#D4A0B0','#C08090','#A06070','#E0C0D0'], m: ['#E0C0D0','#D4A0B0','#C08090','#F0D8E0'], i: ['#F0D8E0','#E0C0D0','#D4A0B0','#FFF0F5'], c: ['#1A0810','#2A1020','#3A1830'] },
  { o: ['#8B7AB0','#6B5A90','#4A3A70','#A89AC8'], m: ['#A89AC8','#8B7AB0','#6B5A90','#C8BAD8'], i: ['#C8BAD8','#A89AC8','#8B7AB0','#E0D8F0'], c: ['#0E0815','#1A1028','#2A1A3A'] },
  { o: ['#2A4A7A','#1A3A6A','#0E2A4A','#4A6A9A'], m: ['#4A6A9A','#2A4A7A','#1A3A6A','#6A8ABA'], i: ['#6A8ABA','#4A6A9A','#2A4A7A','#8AAADA'], c: ['#060E1A','#0E1A2A','#16283A'] },
  { o: ['#D8D0C0','#C8C0B0','#B0A898','#E8E0D0'], m: ['#E8E0D0','#D8D0C0','#C8C0B0','#F0ECE0'], i: ['#F0ECE0','#E8E0D0','#D8D0C0','#FFF8F0'], c: ['#0E0E0A','#1A1A14','#2A2820'] },
];
let flowerSprites = [];
let flowers = [];
let tulipsHidden = false;
let explosionActive = false;
let explosionProgress = 0;
let explosionTween = null;
let W, H, tulipCtx;

let mouseX = -9999, mouseY = -9999;
let smMouseX = -9999, smMouseY = -9999;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

function lerp(a, b, t) { return a + (b - a) * t; }

function createTulipSprite(palette) {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const ctx = c.getContext('2d');
  const hc = SPRITE_SIZE / 2;

  function drawPetal(angle, w, h, colors, showVeins) {
    ctx.save();
    ctx.translate(hc, hc);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w, -h * 0.3, -w * 0.8, -h * 0.7);
    ctx.quadraticCurveTo(-w * 0.35, -h * 0.95, 0, -h);
    ctx.quadraticCurveTo(w * 0.35, -h * 0.95, w * 0.8, -h * 0.7);
    ctx.quadraticCurveTo(w, -h * 0.3, 0, 0);
    ctx.closePath();

    const g = ctx.createRadialGradient(0, -h * 0.5, 0, 0, -h * 0.5, h * 1.1);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.4, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fill();

    if (showVeins) {
      ctx.strokeStyle = colors[3];
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.15;
      for (let v = -1; v <= 1; v++) {
        const ox = v * w * 0.35;
        ctx.beginPath();
        ctx.moveTo(ox * 0.1, -h * 0.05);
        ctx.quadraticCurveTo(ox * 0.7, -h * 0.4, ox * 0.5, -h * 0.8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  const outerW = hc * 0.52, outerH = hc * 0.78;
  const midW = hc * 0.42, midH = hc * 0.62;
  const innerW = hc * 0.32, innerH = hc * 0.46;

  for (let i = 0; i < 3; i++) {
    drawPetal(i / 3 * Math.PI * 2, outerW, outerH, palette.o, true);
  }
  for (let i = 0; i < 3; i++) {
    drawPetal(i / 3 * Math.PI * 2 + Math.PI / 3, midW, midH, palette.m, true);
  }
  for (let i = 0; i < 3; i++) {
    drawPetal(i / 3 * Math.PI * 2, innerW, innerH, palette.i, false);
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  const cGrad = ctx.createRadialGradient(hc, hc, 0, hc, hc, hc * 0.13);
  cGrad.addColorStop(0, palette.c[0]);
  cGrad.addColorStop(0.6, palette.c[1]);
  cGrad.addColorStop(1, palette.c[2]);
  ctx.beginPath();
  ctx.arc(hc, hc, hc * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = cGrad;
  ctx.fill();

  return c;
}

function initFlowers() {
  flowerSprites = COLOR_PALETTES.map(p => createTulipSprite(p));
  W = window.innerWidth;
  H = window.innerHeight;
  tulipCanvas.width = W;
  tulipCanvas.height = H;
  tulipCtx = tulipCanvas.getContext('2d');

  flowers = [];
  for (let i = 0; i < NUM_FLOWERS; i++) {
    flowers.push({
      baseX: (Math.random() - 0.5) * 1600,
      baseY: (Math.random() - 0.5) * 1200,
      z: Math.random() * 600 - 100,
      smoothedX: 0, smoothedY: 0,
      size: 0.5 + Math.random() * 0.9,
      baseRotation: (Math.random() - 0.5) * 0.12,
      swaySpeed: 0.2 + Math.random() * 0.4,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmount: 0.01 + Math.random() * 0.03,
      swayAmp: 1.5 + Math.random() * 2.5,
      spriteIdx: Math.floor(Math.random() * COLOR_PALETTES.length),
      exitVx: 0, exitVy: 0,
    });
  }
}

function renderFlowers(time) {
  if (tulipsHidden) {
    tulipCtx.clearRect(0, 0, W, H);
    return;
  }

  const hc = SPRITE_SIZE / 2;
  const hw = W / 2;
  const hh = H / 2;

  tulipCtx.clearRect(0, 0, W, H);

  if (explosionActive) {
    const ep = explosionProgress;
    for (let i = 0; i < NUM_FLOWERS; i++) {
      const f = flowers[i];
      const sc = FOCAL / (FOCAL + f.z);
      const sx = f.smoothedX * sc + hw;
      const sy = f.smoothedY * sc + hh;
      const screenX = sx + f.exitVx * ep * ep * 1.2;
      const screenY = sy + f.exitVy * ep * ep * 1.2;
      const sc2 = sc * f.size;
      if (sc2 < 0.01) continue;
      if (screenX < -SPRITE_SIZE || screenX > W + SPRITE_SIZE || screenY < -SPRITE_SIZE || screenY > H + SPRITE_SIZE) continue;

      const swayRot = Math.sin(time * f.swaySpeed + f.swayPhase) * f.swayAmount;
      const rot = f.baseRotation + swayRot;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const a = sc2 * cos;
      const b = sc2 * sin;
      const c = -sc2 * sin;
      const d = sc2 * cos;
      tulipCtx.setTransform(a, b, c, d, screenX, screenY);
      tulipCtx.drawImage(flowerSprites[f.spriteIdx], -hc, -hc);
    }
    tulipCtx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }

  const sxArr = new Float64Array(NUM_FLOWERS);
  const syArr = new Float64Array(NUM_FLOWERS);
  const scArr = new Float64Array(NUM_FLOWERS);
  const zArr = new Float64Array(NUM_FLOWERS);
  const visible = [];

  for (let i = 0; i < NUM_FLOWERS; i++) {
    const f = flowers[i];
    const sc = FOCAL / (FOCAL + f.z);
    sxArr[i] = f.smoothedX * sc + hw;
    syArr[i] = f.smoothedY * sc + hh;
    scArr[i] = sc * f.size;
    zArr[i] = f.z;
  }

  for (let i = 0; i < NUM_FLOWERS; i++) {
    if (scArr[i] >= 0.012 && sxArr[i] > -SPRITE_SIZE && sxArr[i] < W + SPRITE_SIZE && syArr[i] > -SPRITE_SIZE && syArr[i] < H + SPRITE_SIZE) {
      visible.push(i);
    }
  }

  visible.sort((a, b) => zArr[a] - zArr[b]);

  for (let oi = 0, len = visible.length; oi < len; oi++) {
    const i = visible[oi];
    const f = flowers[i];
    const swayRot = Math.sin(time * f.swaySpeed + f.swayPhase) * f.swayAmount;
    const rot = f.baseRotation + swayRot;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const sc = scArr[i];
    const a = sc * cos;
    const b = sc * sin;
    const c = -sc * sin;
    const d = sc * cos;
    tulipCtx.setTransform(a, b, c, d, sxArr[i], syArr[i]);
    tulipCtx.drawImage(flowerSprites[f.spriteIdx], -hc, -hc);
  }
  tulipCtx.setTransform(1, 0, 0, 1, 0, 0);
}

function updateFlowers() {
  if (tulipsHidden || explosionActive) return;

  smMouseX = lerp(smMouseX, mouseX, 0.07);
  smMouseY = lerp(smMouseY, mouseY, 0.07);

  const t = Date.now() * 0.001;
  const hw = W / 2;
  const hh = H / 2;
  const REPULSION_RADIUS = 120;

  for (let i = 0; i < NUM_FLOWERS; i++) {
    const f = flowers[i];
    let tx = f.baseX;
    let ty = f.baseY;

    const sc = FOCAL / (FOCAL + f.z);
    const px = f.smoothedX * sc + hw;
    const py = f.smoothedY * sc + hh;
    const dx = px - smMouseX;
    const dy = py - smMouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < REPULSION_RADIUS && dist > 0.5) {
      const force = (REPULSION_RADIUS - dist) / REPULSION_RADIUS;
      const push = force * force * 80;
      tx += (dx / dist) * push;
      ty += (dy / dist) * push;
    }

    tx += Math.sin(t * f.swaySpeed + f.swayPhase) * f.swayAmp;
    ty += Math.cos(t * f.swaySpeed * 0.7 + f.swayPhase * 0.9) * f.swayAmp;
    f.smoothedX = lerp(f.smoothedX, tx, 0.05);
    f.smoothedY = lerp(f.smoothedY, ty, 0.05);
  }
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, -0.5, 9.5);
  camera.lookAt(0, -0.8, 0);

  // Keep the orbit state's spherical coordinates consistent with this
  // starting position, so the very first scroll-driven orbit tween starts
  // from exactly where the camera already is rather than snapping.
  // polar = 0 is level with the flower (looking horizontally); the scroll
  // finale brings it up to a gentle high three-quarter angle, not all the
  // way to vertical, since a true top-down view exposed how the scanned
  // bloom isn't perfectly radially symmetric (it would visually drift
  // off-center as the model turned beneath an overhead camera).
  cameraOrbit.targetY = -0.8;
  syncCameraOrbitFromPosition();

  renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function createStarfield() {
  const count = 2500;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const white = new THREE.Color(0xffffff);
  const lightBlue = new THREE.Color(0xe0f2fe);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;

    const c = Math.random() > 0.5 ? white : lightBlue;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  starParticles = new THREE.Points(geometry, material);
  scene.add(starParticles);
}

function makeRadialGradientTexture(colorStops, size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  colorStops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft, slow-drifting nebula clouds behind the starfield: a handful of large
// additive-blended billboards in colors pulled from the tulip's own palette,
// so the whole scene feels like one composed environment rather than a
// generic "flower in front of a sky" setup.
function createNebula() {
  nebulaSprites = [];
  const nebulaTex = makeRadialGradientTexture([
    [0, 'rgba(255,255,255,1)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  const palette = [
    { color: 0x6e1f3a, scale: 22, opacity: 0.22 },  // deep rose
    { color: 0x2a1840, scale: 26, opacity: 0.18 },  // dusk violet
    { color: 0x16263d, scale: 24, opacity: 0.16 },  // midnight blue
    { color: 0x4a2418, scale: 18, opacity: 0.14 },  // ember umber
  ];

  palette.forEach((p, i) => {
    const mat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: p.color,
      transparent: true,
      opacity: p.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const angle = (i / palette.length) * Math.PI * 2;
    sprite.position.set(
      Math.cos(angle) * 9 + (Math.random() - 0.5) * 4,
      Math.sin(angle) * 5 + (Math.random() - 0.5) * 4,
      -14 - Math.random() * 8
    );
    sprite.scale.set(p.scale, p.scale, 1);
    sprite.userData.driftSpeed = 0.02 + Math.random() * 0.03;
    sprite.userData.driftPhase = Math.random() * Math.PI * 2;
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.scrollOffsetY = 0;
    scene.add(sprite);
    nebulaSprites.push(sprite);
  });
}

// Tiny warm "ember" motes drifting upward through the scene, like embers
// rising from a candle — reinforces the candlelit/romantic mood and gives
// the empty space around the tulip something alive happening in it.
function createEmberMotes() {
  const count = 90;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12 - 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 + 2;
    speeds[i] = 0.15 + Math.random() * 0.25;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  emberData = { speeds, phases, basePositions: positions.slice() };

  const emberTex = makeRadialGradientTexture([
    [0, 'rgba(255,210,160,1)'],
    [0.4, 'rgba(230,140,100,0.7)'],
    [1, 'rgba(200,100,80,0)'],
  ], 64);

  const material = new THREE.PointsMaterial({
    size: 0.09,
    map: emberTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    color: 0xf0b896,
  });

  emberMotes = new THREE.Points(geometry, material);
  scene.add(emberMotes);
}

// Creates a lightweight gradient-sphere canvas texture that gives metallic
// Three.js materials convincing chrome reflections without a real HDR envmap.
function makeChromeEnvMap() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size;
  const ctx = c.getContext('2d');

  // Simulate a dark studio environment with two soft light sources
  const grad = ctx.createLinearGradient(0, 0, size * 2, size);
  grad.addColorStop(0.0, '#05050a');
  grad.addColorStop(0.15, '#1a1a2a');
  grad.addColorStop(0.3, '#0a0610');
  grad.addColorStop(0.45, '#2a1020');  // warm rose nebula reflection
  grad.addColorStop(0.6, '#0c0c18');
  grad.addColorStop(0.75, '#161624');
  grad.addColorStop(0.9, '#05050a');
  grad.addColorStop(1.0, '#05050a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size * 2, size);

  // Add two soft hot-spot reflections
  for (const [x, y, r, col] of [
    [size * 0.55, size * 0.35, size * 0.18, 'rgba(220,210,255,0.7)'],
    [size * 1.4, size * 0.6, size * 0.12, 'rgba(255,180,120,0.45)'],
  ]) {
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, col);
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, size * 2, size);
  }

  const tex = new THREE.CanvasTexture(c, THREE.EquirectangularReflectionMapping);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Liquid mercury blobs: chrome metaball-like spheres floating behind the
// flower. They pulse/morph with a sine-wave scale, and scroll pulls them
// magnetically toward the flower stem. Each blob's position and morph phase
// is stored in userData so updateMercuryBlobs() can animate them every frame.
function createMercuryBlobs() {
  const envMap = makeChromeEnvMap();
  scene.environment = envMap; // makes all metallic materials in the scene reflective

  const blobPositions = [
    [-3.5, 1.8, -3.2],
    [ 3.2, 0.6, -4.0],
    [-2.2, -1.2, -2.8],
    [ 2.8, -0.8, -3.5],
    [-1.0,  2.4, -5.0],
    [ 1.5,  1.0, -2.5],
    [-3.0, -0.2, -4.5],
  ];

  blobPositions.forEach(([x, y, z], i) => {
    const baseRadius = 0.18 + Math.random() * 0.22;
    const geo = new THREE.SphereGeometry(baseRadius, 40, 40);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xaaaaaa,
      metalness: 1.0,
      roughness: 0.02,
      envMap,
      envMapIntensity: 1.4,
    });
    const blob = new THREE.Mesh(geo, mat);
    blob.position.set(x, y, z);
    blob.userData = {
      basePos: new THREE.Vector3(x, y, z),
      baseRadius,
      morphPhase: Math.random() * Math.PI * 2,
      morphSpeed: 0.35 + Math.random() * 0.25,
      scrollPull: 0,   // 0–1, set by scroll progress
    };
    scene.add(blob);
    mercuryBlobs.push(blob);
  });
}

// Silk ribbons: sinusoidal Line curves that ripple like cloth in slow motion.
// Using THREE.Line + in-place BufferAttribute updates instead of TubeGeometry
// rebuild every frame — eliminates per-frame geometry allocation / GC jank.
const RIBBON_STEPS = 42;
function createSilkRibbons() {
  const ribbonDefs = [
    { color: 0x3d0810, opacity: 0.78, xBias: -0.65, additive: false },
    { color: 0x8a0020, opacity: 0.45, xBias:  0.52, additive: false },
    { color: 0xffeedd, opacity: 0.09, xBias:  0.88, additive: true  },
    { color: 0x5a1020, opacity: 0.55, xBias: -0.92, additive: false },
  ];

  ribbonDefs.forEach((def, ri) => {
    const count = RIBBON_STEPS + 1;
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    updateRibbonPositions(positions, ri, def.xBias, 0);
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();

    const mat = new THREE.LineBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: def.opacity,
      blending: def.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });

    const line = new THREE.Line(geo, mat);
    line.userData = { ribbonIndex: ri, def };
    scene.add(line);
    silkRibbons.push(line);
  });
}

// Writes ribbon point positions directly into a Float32Array in-place.
function updateRibbonPositions(positions, index, xBias, time) {
  for (let i = 0; i <= RIBBON_STEPS; i++) {
    const t = i / RIBBON_STEPS;
    const y = 3.2 - t * 7.8;
    const sway = Math.sin(t * Math.PI * 3.2 + time * 0.45 + index * 1.1) * (0.55 + t * 0.38);
    const x = xBias * (0.38 + t * 0.58) + sway * 0.48;
    const z = -2.1 - t * 1.6 + Math.cos(t * Math.PI * 2.1 + time * 0.28) * 0.32;
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
}

function updateSilkRibbons(time) {
  if (isCoarsePointer && (Math.round(time * 30) % 2 !== 0)) return;
  silkRibbons.forEach((ribbon) => {
    const { ribbonIndex, def } = ribbon.userData;
    const posAttr = ribbon.geometry.attributes.position;
    updateRibbonPositions(posAttr.array, ribbonIndex, def.xBias, time);
    posAttr.needsUpdate = true;
  });
}

function setupLights() {
  // Soft ambient — dark, matching the black-cosmos background, slightly warm
  const ambient = new THREE.AmbientLight(0x1a0f0d, 0.55);
  scene.add(ambient);

  // Key light: slightly less intense now that the surface is much rougher —
  // on high-roughness materials a too-bright spotlight creates a hot, flat disc
  const warmSpot = new THREE.SpotLight(0xffd4a0, 7.5);
  warmSpot.position.set(2.5, 5, 4);
  warmSpot.angle = 0.32;
  warmSpot.penumbra = 0.75;
  warmSpot.decay = 1.4;
  warmSpot.distance = 22;
  warmSpot.castShadow = true;
  warmSpot.shadow.mapSize.width = 1024;
  warmSpot.shadow.mapSize.height = 1024;
  warmSpot.target.position.set(0, 0, 0);
  scene.add(warmSpot);
  scene.add(warmSpot.target);

  // Cool rim from upper-left-back — catches the outer petal edges with a
  // cold blue-white halo, giving the flower separation from the dark BG
  const rimLight = new THREE.DirectionalLight(0xb8d4f0, 4.5);
  rimLight.position.set(-2, 3, -5);
  rimLight.target.position.set(0, 0, 0);
  rimLight.castShadow = false;
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Warm fill from below — simulates ambient bounce off the dark ground,
  // so the underside of petals doesn't go pure black
  const belowFill = new THREE.PointLight(0x6b1020, 3.5, 14, 2);
  belowFill.position.set(0, -4, 2);
  scene.add(belowFill);

  // Side fill — keeps the shaded half of the flower from being invisible
  const sideFill = new THREE.DirectionalLight(0xd4b8a0, 0.9);
  sideFill.position.set(-3, 0.5, 2);
  scene.add(sideFill);

  // Inner glow starts off, ramped up by the scroll finale
  finaleGlowLight = new THREE.PointLight(0xffceac, 0, 6, 2);
  finaleGlowLight.position.set(0, 0.3, 0);
  scene.add(finaleGlowLight);
}

// The source model's baked UV atlas is fragmented (visible as the blotchy
// red/black checkerboard on the petals), and it also carries a second UV
// channel that Three.js samples for emissiveMap by default — sampling a
// gradient texture through those broken coordinates is what produced the
// patchy lighting. The fix avoids texture sampling entirely: every mesh
// gets a single flat PBR material, and a per-vertex color (computed once
// from each vertex's local height) blends between a bloom color up top
// and a deeper base color down near the tapered point, giving a clean,
// deliberate two-tone tulip with no UV dependency at all.
// Petal color: a deeply desaturated dark wine-crimson. The key insight is
// that real dark tulip petals are almost maroon-black in low light — vivid
// only where highlights catch them. This sits naturally against the near-black
// background without looking like a painted toy.
const TULIP_BLOOM_COLOR = new THREE.Color(0x5a1018);
// Stem/base: dark forest-green, clearly botanical and distinct from the petals
// while still receding naturally into the dark background.
const TULIP_BASE_COLOR = new THREE.Color(0x16280e);
const TULIP_BLEND_CENTER = 0.14;
const TULIP_BLEND_SOFTNESS = 0.32;

function applyHeightVertexColors(mesh) {
  const geo = mesh.geometry;
  if (!geo.attributes.position) return;
  geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const range = Math.max(maxY - minY, 0.0001);

  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const y = posAttr.getY(i);
    const normalized = (y - minY) / range; // 0 at base, 1 at top
    let t = (normalized - TULIP_BLEND_CENTER) / TULIP_BLEND_SOFTNESS + 0.5;
    t = Math.max(0, Math.min(1, t));
    // smoothstep for a softer, more natural transition than a linear blend
    t = t * t * (3 - 2 * t);
    tmp.copy(TULIP_BASE_COLOR).lerp(TULIP_BLOOM_COLOR, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Shared uniforms for the hover-flex shader — updated every mousemove.
// All petal materials share references to these same objects so a single
// uniform write (mouseWorld, hoverRadius, flexStrength) reaches all meshes.
const hoverUniforms = {
  uMouseWorld: { value: new THREE.Vector3(9999, 9999, 9999) },
  uHoverRadius: { value: 0.55 },
  uFlexStrength: { value: 0.0 },  // animated in on mouse-enter, out on leave
};

function applyMaterialToMesh(mesh) {
  if (mesh.isMesh) {
    applyHeightVertexColors(mesh);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.28,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(0x8a2030),
      envMapIntensity: 0.25,
      side: THREE.DoubleSide,
    });

    // Inject hover-proximity bend into the material's vertex shader.
    // Each vertex within uHoverRadius of uMouseWorld is gently displaced
    // outward along its normal, creating a realistic soft petal-flex.
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMouseWorld = hoverUniforms.uMouseWorld;
      shader.uniforms.uHoverRadius = hoverUniforms.uHoverRadius;
      shader.uniforms.uFlexStrength = hoverUniforms.uFlexStrength;

      shader.vertexShader = `
        uniform vec3 uMouseWorld;
        uniform float uHoverRadius;
        uniform float uFlexStrength;
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        float dist = length(worldPos - uMouseWorld);
        float falloff = 1.0 - smoothstep(0.0, uHoverRadius, dist);
        // Displace outward along the interpolated surface normal
        vec3 worldNorm = normalize(mat3(modelMatrix) * normal);
        transformed += normal * falloff * falloff * uFlexStrength * 0.18;
        `
      );
    };
    mat.needsUpdate = true;

    mesh.material = mat;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
}

function categorizeMesh(mesh, name) {
  const lower = name.toLowerCase();
  if (lower.includes('outer') || lower.includes('out')) {
    outerPetals.push(mesh);
  } else if (lower.includes('middle') || lower.includes('mid')) {
    middlePetals.push(mesh);
  } else if (lower.includes('inner') || lower.includes('inn')) {
    innerPetals.push(mesh);
  } else if (lower.includes('petal') || lower.includes('bloom') || lower.includes('flower') || lower.includes('corolla')) {
    if (lower.includes('back') || lower.includes('rear') || lower.includes('base')) {
      outerPetals.push(mesh);
    } else if (lower.includes('top') || lower.includes('cent') || lower.includes('core')) {
      innerPetals.push(mesh);
    } else {
      middlePetals.push(mesh);
    }
  } else if (lower.includes('leaf') || lower.includes('stem') || lower.includes('stalk') || lower.includes('root') || lower.includes('branch')) {
    otherMeshes.push(mesh);
  } else {
    otherMeshes.push(mesh);
  }
}

function loadModel() {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      'tulip.glb',
      (gltf) => {
        model = gltf.scene;
        modelGroup = new THREE.Group();

        model.traverse((child) => {
          applyMaterialToMesh(child);
          if (child.isMesh) {
            categorizeMesh(child, child.name || child.geometry.name || 'unknown');
          }
        });

        if (outerPetals.length === 0 && middlePetals.length === 0 && innerPetals.length === 0) {
          const allMeshes = [];
          model.traverse((child) => {
            if (child.isMesh) allMeshes.push(child);
          });
          const third = Math.floor(allMeshes.length / 3);
          allMeshes.forEach((m, i) => {
            if (i < third) outerPetals.push(m);
            else if (i < third * 2) middlePetals.push(m);
            else innerPetals.push(m);
          });
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        baseScale = 4 / maxDim;
        modelGroup.scale.set(baseScale, baseScale, baseScale);

        model.position.sub(center);
        modelGroup.add(model);
        modelGroup.position.y = -1.8;
        scene.add(modelGroup);

        storeInitialRotations();
        applyLandingPose();
        attachFinaleGlowToFlower();

        resolve();
      },
      undefined,
      (error) => {
        console.warn('GLTF load failed, creating procedural fallback:', error);
        createFallbackFlower();
        storeInitialRotations();
        applyLandingPose();
        attachFinaleGlowToFlower();
        resolve();
      }
    );
  });
}

// Moves the warm glow light onto the flower itself once it exists, so it
// travels with the bloom during the scroll choreography instead of staying
// fixed in world space. `attach` preserves its current world position while
// reparenting, then we snap it to sit just inside the bloom.
function attachFinaleGlowToFlower() {
  if (!finaleGlowLight) return;
  const parent = model || modelGroup;
  parent.attach(finaleGlowLight);
  finaleGlowLight.position.set(0, 0.3, 0);
}

function storeInitialRotations() {
  const allPetals = [...outerPetals, ...middlePetals, ...innerPetals];
  allPetals.forEach((mesh) => {
    initialRotations.set(mesh, {
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z,
    });
  });
}

function applyLandingPose() {
  const allPetals = [...outerPetals, ...middlePetals, ...innerPetals];
  allPetals.forEach((mesh) => {
    const init = initialRotations.get(mesh);
    if (init) {
      mesh.rotation.x = init.x + 0.4;
    }
  });
}

function createFallbackFlower() {
  modelGroup = new THREE.Group();

  const petalMat = new THREE.MeshPhysicalMaterial({
    color: TULIP_BLOOM_COLOR.clone(),
    roughness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    metalness: 0.05,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xe8a0a8),
    side: THREE.DoubleSide,
  });

  for (let ring = 0; ring < 3; ring++) {
    const count = 6 + ring * 2;
    const isOuter = ring === 0;
    const isMiddle = ring === 1;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const w = 0.6 - ring * 0.1;
      const h = 0.8 - ring * 0.15;
      const geom = new THREE.PlaneGeometry(w, h, 12, 16);
      const mesh = new THREE.Mesh(geom, petalMat.clone());
      mesh.position.set(Math.sin(angle) * (0.25 + ring * 0.2), 0.1 + ring * 0.2, Math.cos(angle) * (0.25 + ring * 0.2));
      mesh.rotation.y = -angle;
      mesh.rotation.x = -0.3 - ring * 0.2;
      mesh.rotation.order = 'YXZ';
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (isOuter) outerPetals.push(mesh);
      else if (isMiddle) middlePetals.push(mesh);
      else innerPetals.push(mesh);

      modelGroup.add(mesh);
    }
  }

  const stemMat = new THREE.MeshPhysicalMaterial({
    color: TULIP_BASE_COLOR.clone(),
    roughness: 0.5,
    metalness: 0,
  });
  const stemGeom = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 8);
  const stem = new THREE.Mesh(stemGeom, stemMat);
  stem.position.y = -0.6;
  stem.castShadow = true;
  stem.receiveShadow = true;
  otherMeshes.push(stem);
  modelGroup.add(stem);

  baseScale = 1.5;
  modelGroup.scale.set(baseScale, baseScale, baseScale);
  modelGroup.position.y = -1.8;
  scene.add(modelGroup);
}

function setupScrollAnimation() {
  if (!modelGroup) return;

  const sections = gsap.utils.toArray('.scroll-section');
  const masterTrigger = {
    trigger: '#scrollContainer',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    invalidateOnRefresh: true,
  };

  // The tulip model is a single fused sculpt rather than separable petal
  // rings, so it is animated as one rigid body: a gentle full-model bow,
  // turn, and drift that tracks the reading position. Nothing here ever
  // rotates a sub-mesh independently, so the bloom can't pull itself apart.
  const tiltTarget = { x: modelGroup.rotation.x, y: modelGroup.rotation.y, z: modelGroup.rotation.z };
  const baseY = modelGroup.position.y;
  const baseModelScale = modelGroup.scale.x;
  // Reduced-motion preference keeps the page navigable without the fuller
  // camera dolly / model swing, while touch devices get a slightly calmer
  // version that won't feel disorienting on smaller, closer screens.
  const motionScale = prefersReducedMotion ? 0.15 : (isCoarsePointer ? 0.65 : 1);

  // From here on the camera is driven by the spherical orbit state
  // (cameraOrbit) rather than raw position tweens, and applyCameraOrbit()
  // re-aims it at the flower every frame — this is what lets the finale
  // swing the camera all the way to a top-down shot without the flower
  // ever drifting out of frame. Resync first, since the warp sequence that
  // ran just before this moved the camera with plain position tweens.
  syncCameraOrbitFromPosition();
  orbitActive = true;
  const orbitStart = { radius: cameraOrbit.radius, polar: cameraOrbit.polar, azimuth: cameraOrbit.azimuth, targetY: cameraOrbit.targetY };

  const tl = gsap.timeline({ scrollTrigger: masterTrigger });

  // ACT 1 — "Our Story" (0 -> 0.30): an establishing turn. The camera
  // drifts slightly sideways and the flower settles into its resting tilt.
  // The blur rack begins here too — the flower starts soft/out-of-focus
  // at the very top of the page and sharpens as the reader commits to scrolling.
  tl.to(modelGroup.rotation, { x: tiltTarget.x - 0.16 * motionScale, y: tiltTarget.y + 0.4 * motionScale, duration: 0.30, ease: 'none' }, 0)
    .to(cameraOrbit, { azimuth: orbitStart.azimuth + 0.32 * motionScale, polar: orbitStart.polar + 0.08 * motionScale, duration: 0.30, ease: 'none' }, 0);

  // ACT 2 — "The Moments" (0.30 -> 0.58): the orbit climbs a little more
  // and swings back the other way; the flower rises a touch and keeps turning.
  tl.to(modelGroup.rotation, { x: tiltTarget.x - 0.02 * motionScale, y: tiltTarget.y + 0.78 * motionScale, duration: 0.28, ease: 'none' }, 0.30)
    .to(modelGroup.position, { y: baseY + 0.45 * motionScale, duration: 0.28, ease: 'none' }, 0.30)
    .to(cameraOrbit, { azimuth: orbitStart.azimuth - 0.22 * motionScale, polar: orbitStart.polar + 0.22 * motionScale, duration: 0.28, ease: 'none' }, 0.30);

  // ACT 3 — "Forever" (0.58 -> 0.85): the camera continues its gentle
  // climb to a high three-quarter angle (not a full top-down shot — that
  // angle made any natural asymmetry in the scanned bloom read as
  // off-center), and the flower begins to turn back toward a clean,
  // centered resting rotation rather than spinning further away from it.
  tl.to(modelGroup.rotation, { x: tiltTarget.x + 0.1 * motionScale, y: tiltTarget.y + 0.5 * motionScale, duration: 0.27, ease: 'none' }, 0.58)
    .to(modelGroup.position, { y: baseY + 0.62 * motionScale, duration: 0.27, ease: 'none' }, 0.58)
    .to(cameraOrbit, { azimuth: orbitStart.azimuth + 0.05 * motionScale, polar: orbitStart.polar + 0.62 * motionScale, duration: 0.27, ease: 'none' }, 0.58);

  if (finaleGlowLight) {
    tl.to(finaleGlowLight, { intensity: 1.1 * motionScale, duration: 0.27, ease: 'none' }, 0.58);
  }

  // ACT 4 — "The Proposal" (0.85 -> 1.0): everything settles — camera,
  // rotation, and position all ease into their final, centered resting
  // state at once, so the flower comes to rest dead-center in frame
  // exactly as the page reaches the question. x stays at 0 throughout
  // every act (never tweened away from it), so there's nothing to snap back.
  tl.to(modelGroup.rotation, { x: tiltTarget.x + 0.05 * motionScale, y: tiltTarget.y + 0.3 * motionScale, duration: 0.15, ease: 'none' }, 0.85)
    .to(modelGroup.position, { y: baseY + 0.72 * motionScale, duration: 0.15, ease: 'none' }, 0.85)
    .to(cameraOrbit, { azimuth: 0, polar: orbitStart.polar + 0.68 * motionScale, duration: 0.15, ease: 'none' }, 0.85)
    .to(modelGroup.scale, {
      x: baseModelScale * (1 + 0.06 * motionScale),
      y: baseModelScale * (1 + 0.06 * motionScale),
      z: baseModelScale * (1 + 0.06 * motionScale),
      duration: 0.15, ease: 'none'
    }, 0.85);

  if (finaleGlowLight) {
    tl.to(finaleGlowLight, { intensity: 1.7 * motionScale, duration: 0.15, ease: 'none' }, 0.85);
  }

  // Focus rack: the page opens with the flower soft/out-of-focus, as if
  // still emerging from the dark, and sharpens as the reader scrolls in —
  // applied as a CSS blur on the 3D canvas (see applyFocusBlur) so it stays
  // fully compatible with the canvas's transparent background. Resolves to
  // fully sharp well before the proposal so the destination is never the
  // blurriest moment.
  tl.to(focusState, {
    blurAmount: 0,
    duration: 0.45,
    ease: 'power2.out',
    onUpdate: () => applyFocusBlur(focusState.blurAmount),
  }, 0);

  // Starfield and nebula drift opposite the camera for parallax depth, and
  // the tulip canvas (the flat decorative field of tulips) gently dims as
  // we move into the narrative so focus shifts to the story content.
  if (starParticles) {
    tl.to(starParticles.rotation, { y: `+=${0.6 * motionScale}`, x: `+=${0.15 * motionScale}`, duration: 1, ease: 'none' }, 0);
    tl.to(starParticles.position, { y: -0.8 * motionScale, duration: 1, ease: 'none' }, 0);
  }

  // Mercury blobs get pulled toward the stem as scroll progresses
  mercuryBlobs.forEach((blob) => {
    tl.to(blob.userData, { scrollPull: 1 * motionScale, duration: 1, ease: 'power2.in' }, 0);
  });
  nebulaSprites.forEach((sprite, i) => {
    tl.to(sprite.userData, { scrollOffsetY: -1.5 * motionScale, duration: 1, ease: 'none' }, 0);
  });

  tl.to({}, {
    duration: 1,
    onUpdate: function () {
      const p = this.progress();
      if (tulipCanvas) tulipCanvas.style.opacity = String(1 - Math.min(p * 1.4, 1) * 0.85);
    }
  }, 0);

  // Per-section: each narrative card gets its own slight independent sway
  // so the model doesn't feel locked to a single timeline beat.
  sections.forEach((section, i) => {
    gsap.to(modelGroup.rotation, {
      z: tiltTarget.z + (i % 2 === 0 ? 0.06 : -0.06) * motionScale,
      ease: 'sine.inOut',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2,
      }
    });
  });
}

function setupSectionReveals() {
  const narrativeCards = gsap.utils.toArray('.narrative-card');
  // Touch devices get a calmer, flatter version of the tilt: the rotateX/Y
  // values still read as "depth" on a static screenshot-like glance but
  // don't fight the page's own scroll momentum or induce jitter on mobile
  // GPUs. Reduced-motion users get a plain cross-fade with no transform.
  const tiltScale = prefersReducedMotion ? 0 : (isCoarsePointer ? 0.4 : 1);

  narrativeCards.forEach((card) => {
    const isRight = card.classList.contains('right');
    const polaroid = card.querySelector('.polaroid');
    const heading = card.querySelector('h2');
    const paragraphs = card.querySelectorAll('.narrative-text p');
    const sectionNumber = card.querySelector('.section-number');

    gsap.set(card, { transformPerspective: 1600 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        end: 'top 35%',
        toggleActions: 'play none none reverse',
        onEnter: () => card.classList.add('in-view'),
        onLeaveBack: () => card.classList.remove('in-view'),
      }
    });

    tl.fromTo(card,
      { opacity: 0, y: 90 * (prefersReducedMotion ? 0.3 : 1), rotateX: 8 * tiltScale, rotateY: (isRight ? -6 : 6) * tiltScale },
      { opacity: 1, y: 0, rotateX: 0, rotateY: 0, duration: prefersReducedMotion ? 0.6 : 1.3, ease: 'power3.out' }
    );

    tl.fromTo(polaroid,
      { opacity: 0, x: (isRight ? 70 : -70) * (prefersReducedMotion ? 0.2 : 1), rotate: (isRight ? 10 : -10) * tiltScale, scale: 0.85 },
      { opacity: 1, x: 0, scale: 1, duration: prefersReducedMotion ? 0.6 : 1.1, ease: 'power3.out' },
      0.05
    );

    tl.fromTo(sectionNumber,
      { opacity: 0, x: -16 },
      { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' },
      0.25
    );

    tl.fromTo(heading,
      { opacity: 0, y: 24, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'power3.out' },
      0.32
    );

    tl.fromTo(paragraphs,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.12 },
      0.5
    );
  });

  // Proposal section: the finale gets its own slower, more deliberate
  // entrance so it reads as the destination rather than another card.
  const proposalCard = document.querySelector('.proposal-card');
  if (proposalCard) {
    gsap.fromTo(proposalCard,
      { opacity: 0, y: 50, scale: 0.92, filter: 'blur(8px)' },
      {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        duration: 1.4, ease: 'power3.out',
        scrollTrigger: { trigger: proposalCard, start: 'top 80%', end: 'top 40%', toggleActions: 'play none none reverse' }
      }
    );
  }
}

function setupScrollProgress() {
  if (!scrollProgress) return;
  scrollProgress.classList.add('visible');

  ScrollTrigger.create({
    trigger: '#scrollContainer',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      if (scrollProgressFill) scrollProgressFill.style.height = (self.progress * 100) + '%';
    }
  });
}

function setupCursorGlow() {
  if (!cursorGlow || prefersReducedMotion) return;
  let gx = window.innerWidth / 2;
  let gy = window.innerHeight / 2;
  let cx = gx, cy = gy;
  let shown = false;

  document.addEventListener('mousemove', (e) => {
    gx = e.clientX;
    gy = e.clientY;
    if (!shown) {
      shown = true;
      cursorGlow.classList.add('visible');
    }
  });

  gsap.ticker.add(() => {
    cx = lerp(cx, gx, 0.08);
    cy = lerp(cy, gy, 0.08);
    cursorGlow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
  });
}

// Hover petal flex: raycasts from the cursor into the 3D scene each frame,
// finds the intersection point on the flower surface, and updates the
// shared hoverUniforms so the injected vertex shader can bend nearby
// vertices outward, creating the illusion of per-petal hover response.
const _raycaster = new THREE.Raycaster();
const _ndcMouse = new THREE.Vector2();
let _hoverFlexTween = null;

function setupHoverPetalFlex() {
  if (prefersReducedMotion || isCoarsePointer) return; // skip on mobile/touch

  let wasHovering = false;

  gsap.ticker.add(() => {
    if (!modelGroup || !camera || mouseX < 0) return;

    // Convert pixel mouse coords to NDC
    _ndcMouse.set(
      (mouseX / window.innerWidth) * 2 - 1,
      -(mouseY / window.innerHeight) * 2 + 1
    );

    _raycaster.setFromCamera(_ndcMouse, camera);
    const targets = [];
    modelGroup.traverse((o) => { if (o.isMesh) targets.push(o); });
    const hits = _raycaster.intersectObjects(targets, false);

    if (hits.length > 0) {
      // Update the world-space cursor position for the shader
      hoverUniforms.uMouseWorld.value.copy(hits[0].point);
      if (!wasHovering) {
        wasHovering = true;
        if (_hoverFlexTween) _hoverFlexTween.kill();
        _hoverFlexTween = gsap.to(hoverUniforms.uFlexStrength, {
          value: 1, duration: 0.25, ease: 'power2.out',
        });
      }
    } else {
      if (wasHovering) {
        wasHovering = false;
        if (_hoverFlexTween) _hoverFlexTween.kill();
        _hoverFlexTween = gsap.to(hoverUniforms.uFlexStrength, {
          value: 0, duration: 0.45, ease: 'power2.in',
        });
      }
      // Move the cursor far away so no vertices are affected
      hoverUniforms.uMouseWorld.value.set(9999, 9999, 9999);
    }
  });
}

function handleNoButton() {
  function evadeNo() {
    if (isTransformed) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnRect = btnNo.getBoundingClientRect();
    const bw = btnRect.width || 160;
    const bh = btnRect.height || 50;
    let x, y, attempts = 0;
    do {
      x = Math.random() * (vw - bw - 40) + 20;
      y = Math.random() * (vh - bh - 40) + 20;
      attempts++;
    } while (
      Math.abs(x - vw / 2 + bw / 2) < 120 &&
      Math.abs(y - vh / 2 + bh / 2) < 80 &&
      attempts < 20
    );
    btnNo.classList.add('evading');
    btnNo.style.left = x + 'px';
    btnNo.style.top = y + 'px';
  }

  function transformToYes() {
    isTransformed = true;
    btnNo.textContent = 'YES';
    btnNo.classList.remove('evading', 'no-btn');
    btnNo.classList.add('transformed', 'yes-btn');
    btnNo.style.position = '';
    btnNo.style.left = '';
    btnNo.style.top = '';
    btnNo.style.transition = 'all 0.6s ease';
    btnNo.removeEventListener('mouseenter', handleNoInteraction);
    btnNo.removeEventListener('click', handleNoInteraction);
    btnNo.addEventListener('click', handleYesSuccess);
    btnNo.addEventListener('mouseenter', handleYesSuccess);
  }

  function handleNoInteraction(e) {
    e.preventDefault();
    e.stopPropagation();
    noClickCount++;
    if (noClickCount >= 10) transformToYes();
    else evadeNo();
  }

  function handleYesSuccess(e) {
    if (e.type === 'mouseenter') return;
    triggerParticleBurst();
    btnYes.removeEventListener('click', handleYesSuccess);
    btnNo.removeEventListener('click', handleYesSuccess);
  }

  btnNo.addEventListener('mouseenter', handleNoInteraction);
  btnNo.addEventListener('click', handleNoInteraction);
  btnYes.addEventListener('click', handleYesSuccess);
}

function triggerParticleBurst() {
  isParticleActive = true;
  if (particleSystem) {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
  }

  const count = 800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  particleVelocities = [];
  particleLife = [];

  const petalColors = [
    new THREE.Color(0xe8a0b0), new THREE.Color(0xd08090), new THREE.Color(0xf0b0c0),
    new THREE.Color(0xc87080), new THREE.Color(0xf0c0d0), new THREE.Color(0xd890a0),
    new THREE.Color(0xe8b0b8), new THREE.Color(0xc06070),
  ];

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 0.5 + Math.random() * 1.5;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r + 0.5;
    positions[i * 3 + 2] = Math.cos(phi) * r;
    const col = petalColors[Math.floor(Math.random() * petalColors.length)];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
    sizes[i] = 0.03 + Math.random() * 0.08;
    const speed = 0.8 + Math.random() * 1.5;
    particleVelocities.push({ x: (Math.random() - 0.5) * speed, y: (0.5 + Math.random() * 1.2) * speed, z: (Math.random() - 0.5) * speed });
    particleLife.push(1.0);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const tc = document.createElement('canvas');
  tc.width = 32; tc.height = 32;
  const ctx = tc.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(16, 16, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, 16, 4, 8, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  const particleTexture = new THREE.CanvasTexture(tc);

  const material = new THREE.PointsMaterial({
    size: 0.08, map: particleTexture, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 1, vertexColors: true,
  });

  particleSystem = new THREE.Points(geometry, material);
  particleSystem.position.set(0, 0.5, 0);
  scene.add(particleSystem);
  particleOverlay.classList.add('active');

  setTimeout(() => {
    isParticleActive = false;
    particleOverlay.classList.remove('active');
  }, 5000);
}

function updateParticles(delta) {
  if (!particleSystem || !isParticleActive) return;
  const positions = particleSystem.geometry.attributes.position.array;
  let alive = false;
  for (let i = 0; i < positions.length / 3; i++) {
    particleLife[i] -= delta * 0.15;
    if (particleLife[i] <= 0) { particleLife[i] = 0; continue; }
    alive = true;
    const vel = particleVelocities[i];
    positions[i * 3] += vel.x * delta;
    positions[i * 3 + 1] += vel.y * delta;
    positions[i * 3 + 2] += vel.z * delta;
    vel.y -= delta * 0.5;
    positions[i * 3 + 1] += vel.y * delta * 0.5;
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.material.opacity = Math.min(1, particleLife.reduce((a, b) => a + b, 0) / (positions.length / 3) * 2);
  if (!alive) {
    isParticleActive = false;
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
    particleOverlay.classList.remove('active');
  }
}

function animateModel() {
  if (modelGroup && isLanding) {
    const time = clock.getElapsedTime();
    modelGroup.rotation.y = Math.sin(time * 0.12) * 0.08;
    modelGroup.position.y = -1.8 + Math.sin(time * 0.25) * 0.015;
  }
}

let resizeRefreshTimeout = null;
function handleResize() {
  W = window.innerWidth;
  H = window.innerHeight;
  if (tulipCanvas) { tulipCanvas.width = W; tulipCanvas.height = H; }
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);

  if (!isLanding && typeof ScrollTrigger !== 'undefined') {
    clearTimeout(resizeRefreshTimeout);
    resizeRefreshTimeout = setTimeout(() => ScrollTrigger.refresh(), 200);
  }
}

// Recomputes the spherical orbit state from wherever the camera actually
// is right now. Needed before switching on orbit-driven camera control,
// since the landing/warp sequence moves the camera with plain position
// tweens — without this resync, applyCameraOrbit's first frame would
// snap the camera back to its pre-warp distance.
function syncCameraOrbitFromPosition() {
  const dy = camera.position.y - cameraOrbit.targetY;
  const dz = camera.position.z;
  const dx = camera.position.x;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  cameraOrbit.radius = Math.sqrt(dy * dy + horizontalDist * horizontalDist);
  cameraOrbit.polar = Math.atan2(dy, horizontalDist);
  cameraOrbit.azimuth = Math.atan2(dx, dz);
}

// Applies the depth-of-field focus rack as a CSS blur filter on the 3D
// canvas. This is intentionally not a Three.js postprocessing pass — the
// classic BokehShader hardcodes gl_FragColor.a = 1.0 which would have
// made the canvas opaque, breaking all the CSS-layer compositing beneath it.
// CSS filter blur preserves the canvas's existing alpha channel perfectly
// and is GPU-accelerated on all modern browsers.
// amount: 0 = tack sharp, 1 = maximum soft focus.
function applyFocusBlur(amount) {
  const px = Math.round(amount * 14);   // 0–14 px blur, feels like real lens pull
  const brightness = 1 - amount * 0.18; // very slightly dimmer when out of focus,
  // reinforcing the "deep in darkness" initial feel
  if (threeCanvas) {
    threeCanvas.style.filter = px > 0
      ? `blur(${px}px) brightness(${brightness.toFixed(2)})`
      : 'none';
  }
  if (tulipCanvas) {
    tulipCanvas.style.filter = px > 0
      ? `blur(${Math.round(px * 0.6)}px) brightness(${brightness.toFixed(2)})`
      : 'none';
  }
}

function applyCameraOrbit() {
  const { radius, polar, azimuth, targetY } = cameraOrbit;
  // Spherical-ish orbit around the flower: azimuth swings the camera
  // sideways around the vertical axis, polar swings it up from level
  // toward directly overhead.
  const horizontalRadius = radius * Math.cos(polar);
  camera.position.x = Math.sin(azimuth) * horizontalRadius;
  camera.position.z = Math.cos(azimuth) * horizontalRadius;
  camera.position.y = targetY + radius * Math.sin(polar);
  camera.lookAt(0, targetY, 0);
}

function updateNebula(time) {
  nebulaSprites.forEach((sprite) => {
    const d = sprite.userData;
    sprite.position.x = d.baseX + Math.sin(time * d.driftSpeed + d.driftPhase) * 1.2;
    sprite.position.y = d.baseY + (d.scrollOffsetY || 0) + Math.cos(time * d.driftSpeed * 0.8 + d.driftPhase) * 0.8;
  });
}

function updateEmberMotes(time) {
  if (!emberMotes || !emberData) return;
  const posAttr = emberMotes.geometry.attributes.position;
  const { speeds, phases, basePositions } = emberData;
  const count = speeds.length;
  for (let i = 0; i < count; i++) {
    const baseX = basePositions[i * 3];
    const baseY = basePositions[i * 3 + 1];
    const baseZ = basePositions[i * 3 + 2];
    const t = time * speeds[i] + phases[i];
    // gentle upward drift that loops, plus a soft horizontal sway
    const riseRange = 10;
    const y = baseY + ((t * 0.6) % riseRange) - riseRange / 2;
    posAttr.setXYZ(i, baseX + Math.sin(t) * 0.4, y, baseZ + Math.cos(t * 0.7) * 0.3);
  }
  posAttr.needsUpdate = true;
}

function updateMercuryBlobs(time) {
  mercuryBlobs.forEach((blob) => {
    const d = blob.userData;
    // Sine-wave scale pulse — different frequency per blob for organic feel
    const pulse = 1.0 + Math.sin(time * d.morphSpeed + d.morphPhase) * 0.18
                      + Math.sin(time * d.morphSpeed * 1.7 + d.morphPhase * 0.5) * 0.08;
    blob.scale.setScalar(pulse);

    // Magnetic pull toward the stem as scroll progresses
    const pull = d.scrollPull;
    const stemTarget = new THREE.Vector3(
      d.basePos.x * (1 - pull) * 0.3,
      d.basePos.y * (1 - pull * 0.6),
      d.basePos.z * (1 - pull * 0.4) + pull * 1.5   // drift forward toward flower
    );

    // Gentle idle drift layered on top
    const driftX = Math.sin(time * 0.22 + d.morphPhase) * 0.12;
    const driftY = Math.cos(time * 0.17 + d.morphPhase * 0.7) * 0.08;

    blob.position.x = lerp(blob.position.x, stemTarget.x + driftX, 0.02);
    blob.position.y = lerp(blob.position.y, stemTarget.y + driftY, 0.02);
    blob.position.z = lerp(blob.position.z, stemTarget.z, 0.015);
  });
}


function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  updateFlowers();
  renderFlowers(time);

  if (starParticles) starParticles.rotation.y += delta * 0.02;
  updateNebula(time);
  updateEmberMotes(time);
  updateMercuryBlobs(time);
  updateSilkRibbons(time);
  animateModel();
  updateParticles(delta);
  if (orbitActive) applyCameraOrbit();
  renderer.render(scene, camera);
}

function startFlowerExplosion() {
  explosionActive = true;
  explosionProgress = 0;

  for (let i = 0; i < NUM_FLOWERS; i++) {
    const f = flowers[i];
    const angle = Math.atan2(f.baseY, f.baseX) + (Math.random() - 0.5) * 0.4;
    const speed = 3000 + Math.random() * 4000;
    f.exitVx = Math.cos(angle) * speed;
    f.exitVy = Math.sin(angle) * speed;
  }

  explosionTween = gsap.to(
    { p: 0 },
    {
      p: 1,
      duration: 3,
      ease: 'power2.out',
      onUpdate: function () {
        explosionProgress = this.targets()[0].p;
      },
      onComplete: () => {
        explosionActive = false;
        tulipsHidden = true;
        if (tulipCtx) tulipCtx.clearRect(0, 0, W, H);
      }
    }
  );
}

function onReveal() {
  if (!isLanding) return;
  isLanding = false;

  // Action A: Instantly remove the REVEAL button
  revealBtn.style.display = 'none';

  // Action B: Gracefully scatter flowers off-screen
  startFlowerExplosion();

  // Action C: Keep the intro card text visible, hold frozen for 7 seconds
  holdTimeout = setTimeout(completeReveal, 7000);
}

function completeReveal() {
  if (isRevealed) return;
  isRevealed = true;

  // Step C: Fade out intro text card over 1.5s, then hide from layout
  gsap.to(landing, {
    opacity: 0,
    duration: 1.5,
    ease: 'power2.out',
    onComplete: () => {
      landing.style.visibility = 'hidden';

      // Step D: Only after text is fully gone, trigger 3.5s cosmic warp
      gsap.to(camera.position, {
        z: 5.5,
        duration: 3.5,
        ease: 'power1.inOut',
      });

      if (starParticles) {
        gsap.to(starParticles.scale, {
          x: 2.5, y: 2.5, z: 2.5,
          duration: 3.5,
          ease: 'power1.inOut',
        });
      }

      // After warp completes, reveal scrollContainer and unlock scrolling
      setTimeout(() => {
        document.body.classList.add('scrollable');
        gsap.to(scrollContainer, {
          visibility: 'visible',
          pointerEvents: 'auto',
          duration: 0.6,
          ease: 'power2.out',
        });
        setupScrollAnimation();
        setupSectionReveals();
        setupScrollProgress();
        ScrollTrigger.refresh();
      }, 3700);
    }
  });
}

async function init() {
  initFlowers();
  initScene();
  createStarfield();
  createNebula();
  createEmberMotes();
  createMercuryBlobs();
  createSilkRibbons();
  setupLights();
  await loadModel();

  // Start fully blurred so the flower feels like it's emerging from the
  // dark as the user begins scrolling. The scroll timeline unblurs it.
  applyFocusBlur(1);

  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouseX = t.clientX; mouseY = t.clientY; }, { passive: true });

  handleNoButton();
  setupCursorGlow();
  setupHoverPetalFlex();
  revealBtn.addEventListener('click', onReveal);
  window.addEventListener('resize', handleResize);
  animate();
}

init();
