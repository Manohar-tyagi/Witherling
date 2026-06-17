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

function setupLights() {
  const ambient = new THREE.AmbientLight(0x221a18, 0.3);
  scene.add(ambient);

  const warmSpot = new THREE.SpotLight(0xf0c8a0, 10);
  warmSpot.position.set(2, 4, 3);
  warmSpot.angle = 0.35;
  warmSpot.penumbra = 0.6;
  warmSpot.decay = 1.2;
  warmSpot.distance = 20;
  warmSpot.castShadow = true;
  warmSpot.shadow.mapSize.width = 1024;
  warmSpot.shadow.mapSize.height = 1024;
  warmSpot.target.position.set(0, 0, 0);
  scene.add(warmSpot);
  scene.add(warmSpot.target);

  const icyBlue = new THREE.DirectionalLight(0x8ab4d4, 6);
  icyBlue.position.set(-1, 1.5, -5);
  icyBlue.target.position.set(0, 0, 0);
  icyBlue.castShadow = true;
  scene.add(icyBlue);
  scene.add(icyBlue.target);

  const fillLight = new THREE.DirectionalLight(0xd4b8a0, 0.8);
  fillLight.position.set(-2, 1, 2);
  scene.add(fillLight);

  const rimFill = new THREE.DirectionalLight(0xf0d8c0, 0.5);
  rimFill.position.set(3, -1, -2);
  scene.add(rimFill);
}

function createRoseGoldEmissive() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(200, 120, 100, 0.4)');
  gradient.addColorStop(0.3, 'rgba(180, 100, 80, 0.15)');
  gradient.addColorStop(0.7, 'rgba(160, 90, 70, 0.05)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function applyMaterialToMesh(mesh) {
  if (mesh.isMesh) {
    const emissiveTex = createRoseGoldEmissive();
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0B192C),
      roughness: 0.65,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      metalness: 0,
      emissive: new THREE.Color(0xc87864),
      emissiveIntensity: 0.08,
      emissiveMap: emissiveTex,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
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
          if (child.isMesh) console.log(child.name);
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

        resolve();
      },
      undefined,
      (error) => {
        console.warn('GLTF load failed, creating procedural fallback:', error);
        createFallbackFlower();
        storeInitialRotations();
        applyLandingPose();
        resolve();
      }
    );
  });
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
    color: 0x0B192C,
    roughness: 0.65,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    metalness: 0,
    emissive: 0xc87864,
    emissiveIntensity: 0.08,
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
      mesh.material.color.setHSL(0.63 + ring * 0.02, 0.4 + ring * 0.05, 0.12 + ring * 0.03);
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
    color: 0x1a2a1a,
    roughness: 0.8,
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

  const tl = gsap.timeline({ scrollTrigger: masterTrigger });

  // Whole-flower choreography: a single continuous bow + turn + settle,
  // built from one rigid transform so the silhouette stays intact throughout.
  // Each segment is given an explicit duration (summing to 1) rather than
  // relying on GSAP's default tween length, so timeline progress maps
  // predictably to scroll position with no overshoot or snapping.
  tl.to(modelGroup.rotation, { x: tiltTarget.x - 0.5 * motionScale, y: tiltTarget.y + 0.9 * motionScale, duration: 0.34, ease: 'none' }, 0)
    .to(modelGroup.rotation, { y: tiltTarget.y + 1.85 * motionScale, x: tiltTarget.x - 0.15 * motionScale, duration: 0.33, ease: 'none' }, 0.34)
    .to(modelGroup.rotation, { y: tiltTarget.y + 2.6 * motionScale, x: tiltTarget.x + 0.25 * motionScale, duration: 0.33, ease: 'none' }, 0.67)
    .to(modelGroup.position, { y: baseY + 1.35 * motionScale, duration: 0.5, ease: 'none' }, 0)
    .to(modelGroup.position, { x: -1.6 * motionScale, duration: 0.5, ease: 'none' }, 0)
    .to(modelGroup.position, { x: 1.6 * motionScale, duration: 0.35, ease: 'none' }, 0.5)
    .to(modelGroup.position, { x: 0, y: baseY + 0.4 * motionScale, duration: 0.15, ease: 'none' }, 0.85)
    .to(modelGroup.scale, { x: baseModelScale * (1 - 0.28 * motionScale), y: baseModelScale * (1 - 0.28 * motionScale), z: baseModelScale * (1 - 0.28 * motionScale), duration: 0.5, ease: 'none' }, 0)
    .to(modelGroup.scale, { x: baseModelScale * (1 - 0.1 * motionScale), y: baseModelScale * (1 - 0.1 * motionScale), z: baseModelScale * (1 - 0.1 * motionScale), duration: 0.15, ease: 'none' }, 0.85);

  // Camera does a slow dolly/orbit so depth keeps changing as the reader
  // descends, reinforcing the sense that this is one continuous 3D space.
  // Offsets are relative to wherever the camera actually is when this runs
  // (after the post-reveal cosmic warp has already moved it), not the
  // scene's original setup position, so the dolly starts from the right place.
  const camBaseY = camera.position.y;
  const camBaseZ = camera.position.z;
  tl.to(camera.position, { y: camBaseY + 0.9 * motionScale, z: camBaseZ - 1.3 * motionScale, duration: 0.5, ease: 'none' }, 0)
    .to(camera.position, { y: camBaseY + 0.3 * motionScale, z: camBaseZ - 2.1 * motionScale, duration: 0.35, ease: 'none' }, 0.5)
    .to(camera.position, { y: camBaseY - 0.1 * motionScale, z: camBaseZ - 0.5 * motionScale, duration: 0.15, ease: 'none' }, 0.85);

  // Starfield drifts opposite the camera for parallax depth, and the tulip
  // canvas (the flat decorative field of tulips) gently dims as we move
  // into the narrative so the focus shifts to the story content.
  if (starParticles) {
    tl.to(starParticles.rotation, { y: `+=${0.6 * motionScale}`, x: `+=${0.15 * motionScale}`, duration: 1, ease: 'none' }, 0);
    tl.to(starParticles.position, { y: -0.8 * motionScale, duration: 1, ease: 'none' }, 0);
  }

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

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  updateFlowers();
  renderFlowers(time);

  if (starParticles) starParticles.rotation.y += delta * 0.02;
  animateModel();
  updateParticles(delta);
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
  setupLights();
  await loadModel();

  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouseX = t.clientX; mouseY = t.clientY; }, { passive: true });

  handleNoButton();
  setupCursorGlow();
  revealBtn.addEventListener('click', onReveal);
  window.addEventListener('resize', handleResize);
  animate();
}

init();
