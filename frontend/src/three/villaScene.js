import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ---------- helpers ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ease = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

const CLAY = "#b3ada1";

// Procedural material textures, drawn on a canvas (no image files needed).
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noise(ctx, w, h, amount, base) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] = Math.min(255, Math.max(0, base[0] + n));
    img.data[i + 1] = Math.min(255, Math.max(0, base[1] + n));
    img.data[i + 2] = Math.min(255, Math.max(0, base[2] + n));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const TEX = {
  stone: () => canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#F2EDE4"; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 14, [242, 237, 228]);
    ctx.strokeStyle = "rgba(120,110,95,0.35)"; ctx.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }),
  wood: () => canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#8B6B4E"; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 25},${20},0.25)`;
      ctx.fillRect(x, 0, 2 + Math.random() * 4, h);
    }
    ctx.strokeStyle = "rgba(40,25,15,0.35)"; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }),
  glass: () => canvasTexture(256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#dfeef0"); g.addColorStop(0.5, "#7fa3ab"); g.addColorStop(1, "#2d4a52");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.moveTo(w * 0.15, 0); ctx.lineTo(w * 0.45, 0); ctx.lineTo(w * 0.05, h); ctx.lineTo(-w * 0.25, h); ctx.fill();
  }),
  lawn: () => canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#8f9479"; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 40, [143, 148, 121]);
  }),
  dark: () => canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#1E1E1E"; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 10, [30, 30, 30]);
  }),
};

// Each material records its clay (grey) and finished colour, so the model can
// morph from a plain clay study to the finished, lit interior.
function makeMats(reg) {
  const mk = (final, { metal = 0, rough = 0.6, glass = false, clay = CLAY, tex = null } = {}) => {
    const m = glass
      ? new THREE.MeshPhysicalMaterial({ color: clay, roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ color: clay, roughness: 0.9 });
    const map = tex ? TEX[tex]() : null;
    reg.push({ m, clay: new THREE.Color(clay), final: new THREE.Color(final), rf: rough, mf: metal, glass, map });
    return m;
  };
  return {
    stone: mk("#F2EDE4", { rough: 0.65, tex: "stone" }),
    deck: mk("#DCD3C3", { rough: 0.8 }),
    lawn: mk("#B9C29E", { rough: 0.95, clay: "#8f9479", tex: "lawn" }),
    charcoal: mk("#1E1E1E", { rough: 0.45, metal: 0.1, tex: "dark" }),
    trim: mk("#C9A86C", { metal: 0.85, rough: 0.28 }),
    glass: mk("#A9C6CC", { rough: 0.04, glass: true, tex: "glass" }),
    wood: mk("#8B6B4E", { rough: 0.6, tex: "wood" }),
    fabric: mk("#D8CFC0", { rough: 0.95 }),
    rug: mk("#C9B9A0", { rough: 1 }),
    green: mk("#6F8260", { rough: 0.9 }),
    water: mk("#7FB7BD", { rough: 0.05 }),
    stoneDark: mk("#D3C9B8", { rough: 0.8 }),
  };
}

function setLook(reg, t) {
  for (const e of reg) {
    e.m.map = t > 0.5 ? e.map || null : null;
    e.m.needsUpdate = e.m.map !== e.lastMap;
    e.lastMap = e.m.map;
    e.m.color.copy(e.clay).lerp(e.final, t);
    e.m.roughness = lerp(0.9, e.rf, t);
    e.m.metalness = e.mf * t;
  }
}

function setGlow(reg, l) {
  for (const e of reg) if (e.glass) { e.m.emissive.set("#ffc98a"); e.m.emissiveIntensity = l * 0.9; }
}

// Grows a part upward from its base. Hidden while collapsed, because a squashed box leaves a flat face behind.
function grow(obj, t) {
  obj.scale.y = Math.max(0.001, t);
  obj.visible = t > 0.01;
}

// Box with its pivot at the base, so scale.y grows the box upward.
function box(parent, w, h, d, x, y, z, mat) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function tree(parent, M, x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 2 * s, 10), M.wood);
  trunk.position.y = s;
  trunk.castShadow = true;
  g.add(trunk);
  // a cluster of crowns reads as foliage rather than a single ball
  for (const [dx, dy, dz, r] of [[0, 2.7, 0, 1.25], [0.7, 2.3, 0.3, 0.9], [-0.6, 2.4, -0.3, 0.95]]) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 2), M.green);
    crown.position.set(dx * s, dy * s, dz * s);
    crown.castShadow = true;
    g.add(crown);
  }
  g.scale.setScalar(0.001);
  parent.add(g);
  return g;
}

function buildVilla(root, reg) {
  const M = makeMats(reg);
  const V = { walls: [], openings: [], concept: [], slabs: [], trees: [], lights: [], posts: [] };

  // site: lawn disc + pool deck and terrace
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(12.5, 96), M.lawn);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.02;
  lawn.receiveShadow = true;
  root.add(lawn);

  box(root, 14.6, 0.3, 9.4, 1, 0, 0.2, M.charcoal); // plinth

  // two volumes: ground floor and a cantilevered upper floor
  const G = box(root, 11, 3.0, 7, -0.5, 0.3, 0, M.stone);
  const U = box(root, 13, 2.8, 6, 1, 3.3, 0, M.stone);
  V.walls.push(G, U);

  // stone cladding joints on the ground floor, and a recessed shadow line under the upper floor
  const joint = new THREE.MeshStandardMaterial({ color: "#CFC8BA", roughness: 0.9 });
  for (let y = 0.75; y < 3.0; y += 0.75) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(11.02, 0.035, 0.04), joint);
    j.position.set(0, y, 3.51);
    G.add(j);
  }
  const shadowLine = new THREE.Mesh(new THREE.BoxGeometry(13.02, 0.16, 0.12), M.charcoal);
  shadowLine.position.set(0, 0.08, 3.04);
  U.add(shadowLine);
  for (const w of V.walls) {
    const lines = new THREE.LineSegments(
      new THREE.EdgesGeometry(w.geometry),
      new THREE.LineBasicMaterial({ color: "#C9A86C", transparent: true, opacity: 0 })
    );
    w.add(lines);
    V.concept.push(lines);
  }

  // glazing + mullions (these appear in the "openings" stage)
  V.openings.push(box(root, 10, 2.5, 0.05, -0.5, 0.6, 3.52, M.glass));
  V.openings.push(box(root, 12, 2.2, 0.05, 1, 3.6, 3.03, M.glass));
  for (let x = -5.5; x <= 4.6; x += 1.25) V.openings.push(box(root, 0.06, 2.5, 0.08, x, 0.6, 3.56, M.charcoal));
  for (let x = -5; x <= 7.1; x += 1.5) V.openings.push(box(root, 0.06, 2.2, 0.08, x, 3.6, 3.07, M.charcoal));

  // entrance door + lock plate (the key goes here in the turnkey reveal)
  box(root, 0.95, 2.2, 0.06, -3.0, 0.3, 3.56, M.charcoal);
  box(root, 0.12, 0.26, 0.03, -2.55, 1.25, 3.6, M.trim);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.1), M.trim);
  canopy.position.set(-3.0, 2.45, 4.05);
  G.add(canopy);

  // roof slab, gold, drops in during construction
  const slab = box(root, 13.4, 0.28, 6.4, 1, 6.1, 0, M.trim);
  V.slabs.push({ mesh: slab, base: 6.1 });

  // terrace under the cantilever, with a slim support column
  box(root, 4, 0.22, 4, 6.5, 0.3, 3.8, M.stoneDark);
  box(root, 0.3, 3.0, 0.3, 7.2, 0.3, 3.0, M.charcoal);

  // reflecting pool in front of the house
  box(root, 12.4, 0.14, 4, 0.5, 0, 9.6, M.deck);
  box(root, 11.6, 0.06, 3.2, 0.5, 0.14, 9.6, M.water);

  // stepping stones from the entrance to the road
  for (const [x, z] of [[-3.0, 6.0], [-3.2, 7.4], [-3.0, 8.8]]) {
    box(root, 0.9, 0.06, 0.6, x, 0, z, M.deck);
  }

  // planters on the terrace
  for (const x of [5.4, 7.4]) box(root, 0.9, 0.5, 0.9, x, 0.52, 5.2, M.green);

  // hedges and lamp posts
  box(root, 0.9, 0.9, 9, -9.5, 0, 1, M.green);
  box(root, 0.9, 0.9, 7, 10, 0, 2, M.green);
  for (const x of [-7.6, 8.8]) {
    box(root, 0.08, 2.4, 0.08, x, 0, 6.2, M.charcoal);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffcf99", emissiveIntensity: 0 })
    );
    bulb.position.set(x, 2.5, 6.2);
    root.add(bulb);
    V.posts.push(bulb.material);
  }

  // furnished interior (scales in during the "design" stage)
  const interior = new THREE.Group();
  root.add(interior);
  box(interior, 3.2, 0.03, 2.2, -2.6, 0.3, -0.2, M.rug);
  box(interior, 2.6, 0.55, 0.9, -2.8, 0.33, -1.1, M.fabric);
  box(interior, 2.6, 0.5, 0.22, -2.8, 0.88, -1.55, M.fabric);
  box(interior, 1.2, 0.32, 0.6, -2.8, 0.33, -0.1, M.wood);
  box(interior, 2.6, 0.75, 1.1, 2.0, 0.3, 0.4, M.wood);
  for (const x of [1.1, 2.9]) for (const z of [-0.2, 1.1]) box(interior, 0.45, 0.45, 0.45, x, 0.3, z, M.fabric);
  box(interior, 5.0, 0.9, 0.6, 1.8, 0.3, -2.9, M.stoneDark); // kitchen run
  box(interior, 5.0, 0.8, 0.34, 1.8, 2.0, -3.15, M.charcoal); // wall units
  box(interior, 2.4, 0.5, 2.0, 2.6, 3.3, -0.6, M.fabric); // bed
  box(interior, 2.4, 0.8, 0.1, 2.6, 3.3, -1.7, M.wood); // headboard
  box(interior, 1.6, 0.4, 0.5, -2.6, 3.3, 1.0, M.wood); // bench
  V.interior = interior;

  // pendant lights
  V.lampMat = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffcf99", emissiveIntensity: 0 });
  for (const [x, y, z] of [[-2.8, 2.6, -0.4], [2.0, 2.6, 0.5], [2.0, 2.6, -2.0], [2.6, 5.4, -0.6]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), V.lampMat);
    l.position.set(x, y, z);
    root.add(l);
  }

  // warm interior lights (intensity driven by the scene)
  for (const [x, y, z] of [[-1.2, 1.9, 0.4], [1.5, 1.9, -1.2], [1.0, 4.8, 0]]) {
    const pl = new THREE.PointLight("#ffb870", 0, 16, 2);
    pl.position.set(x, y, z);
    root.add(pl);
    V.lights.push(pl);
  }

  V.trees.push(
    tree(root, M, -10.5, -4, 1.3),
    tree(root, M, -11, 6.5, 1),
    tree(root, M, 11.5, -4.5, 1.4),
    tree(root, M, 12, 5, 1.1)
  );
  return { V, M };
}

function buildKey(parent) {
  const gold = new THREE.MeshStandardMaterial({ color: "#C9A86C", metalness: 1, roughness: 0.22 });
  const k = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 20), gold);
  shaft.rotation.x = Math.PI / 2;
  k.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 14, 32), gold);
  bow.position.z = -0.8;
  k.add(bow);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.1), gold);
  bit.position.set(0.16, 0, 0.62);
  k.add(bit);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.1), gold);
  teeth.position.set(0.3, -0.06, 0.5);
  k.add(teeth);
  k.traverse((o) => { o.castShadow = true; });
  parent.add(k);
  return k;
}

function makeDust(parent) {
  const n = 260;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: "#E9C98E", size: 0.06, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  parent.add(p);
  return p;
}

// Distance at which a box of `width` x `height` (world units) fills the view.
function frameDistance(vfovDeg, aspect, width, height) {
  const tv = Math.tan((vfovDeg * Math.PI) / 360);
  return Math.max(height / 2 / tv, width / 2 / (tv * aspect)) * 1.12;
}

// Creates one renderer + scene. `withKey` adds the gold key and dust for the turnkey reveal.
export function createStage(canvas, container, withKey = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  const root = new THREE.Group();
  scene.add(root);

  const sun = new THREE.DirectionalLight("#fff3e0", 2.6);
  sun.position.set(12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 80 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#ffffff", "#8a8070", 0.55));

  const reg = [];
  const { V } = buildVilla(root, reg);
  const st = { renderer, scene, camera, container, reg, V, sun, key: null, dust: null, pmrem };
  if (withKey) {
    st.key = buildKey(scene);
    st.dust = makeDust(scene);
  }

  st.resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  st.dispose = () => {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    pmrem.dispose();
    renderer.dispose();
  };

  // start in the construction state
  V.interior.scale.setScalar(0.001);
  V.interior.visible = false;
  V.walls.forEach((w) => grow(w, 0));
  V.openings.forEach((o) => grow(o, 0));
  V.trees.forEach((t) => (t.visible = false));
  if (!withKey) V.slabs.forEach((s) => (s.mesh.visible = false)); // roof appears only in the final stage
  return st;
}

// Orbits the camera around a target so the building is always framed.
function placeCamera(camera, { target, width, height, angle, lift = 0.22, pull = 1 }) {
  const r = frameDistance(camera.fov, camera.aspect, width, height) * pull;
  camera.position.set(target.x + Math.sin(angle) * r, target.y + r * lift, target.z + Math.cos(angle) * r);
  camera.lookAt(target);
}

const PROCESS_TARGET = new THREE.Vector3(0, 2.8, 1.5);

// Process story: p is 0..1 across the sticky section.
export function updateProcess(st, p) {
  const { V, reg, camera, scene, sun } = st;
  const L = (a, b) => ease(a, b, p);

  // 1 foundation → 2 walls → 3 openings → 4 interiors → 5 render → 6 lit & landscaped → 7 finished
  grow(V.walls[0], L(0.15, 0.3));
  grow(V.walls[1], L(0.18, 0.33));
  const op = L(0.3, 0.42);
  V.openings.forEach((o) => grow(o, op));
  const conceptAlpha = L(0.27, 0.36) * (1 - L(0.44, 0.52)) * 0.9;
  V.concept.forEach((l) => (l.material.opacity = conceptAlpha));
  V.interior.scale.setScalar(Math.max(0.001, L(0.45, 0.6)));
  V.interior.visible = L(0.45, 0.6) > 0.01;
  setLook(reg, L(0.6, 0.8));

  const light = L(0.8, 0.97);
  setGlow(reg, light);
  V.lights.forEach((pl) => (pl.intensity = light * 26));
  V.lampMat.emissiveIntensity = light * 2.4;
  V.posts.forEach((m) => (m.emissiveIntensity = light * 3));
  V.slabs.forEach((s) => {
    s.mesh.visible = p >= 0.7;
    s.mesh.position.y = s.base + (1 - L(0.7, 0.85)) * 3.5;
  });
  V.trees.forEach((t) => { t.scale.setScalar(Math.max(0.001, L(0.85, 0.97))); t.visible = L(0.85, 0.97) > 0.01; });

  scene.environmentIntensity = lerp(0.55, 1, L(0.6, 0.8));
  sun.intensity = lerp(1.6, 2.4, L(0.6, 0.8));

  placeCamera(camera, { target: PROCESS_TARGET, width: 18, height: 8.5, angle: 0.35 + p * 0.5, lift: 0.18 });
}

export const KEY_START = new THREE.Vector3(6, 3.5, 7);
export const KEY_OUTSIDE = new THREE.Vector3(-2.55, 1.35, 4.65);
export const KEY_INSERTED = new THREE.Vector3(-2.55, 1.35, 3.03);

// Turnkey reveal: k is 0..1 across the pinned section. Returns true on the frame the key turns.
export function updateTurnkey(st, k) {
  const { V, reg, camera, scene, sun, key, dust } = st;
  const L = (a, b) => ease(a, b, k);

  // the turnkey villa is fully built; it is only dim and locked until the key turns
  V.walls.forEach((w) => grow(w, 1));
  V.openings.forEach((o) => grow(o, 1));
  V.interior.scale.setScalar(1);
  V.interior.visible = true;
  setLook(reg, 1);
  const light = L(0.36, 0.5);
  setGlow(reg, light);
  V.lights.forEach((pl) => (pl.intensity = light * 26));
  V.lampMat.emissiveIntensity = light * 2.4;
  V.posts.forEach((m) => (m.emissiveIntensity = light * 3));
  scene.environmentIntensity = lerp(0.2, 1, light);
  sun.intensity = lerp(0.5, 1.6, light);
  V.trees.forEach((t) => { t.scale.setScalar(Math.max(0.001, L(0.6, 0.75))); t.visible = L(0.6, 0.75) > 0.01; });

  // key: fly in → insert → turn 90°
  const fly = L(0, 0.2), ins = L(0.2, 0.3), turn = L(0.3, 0.36);
  key.position.copy(KEY_START.clone().lerp(KEY_OUTSIDE, fly).lerp(KEY_INSERTED, ins));
  key.rotation.z = turn * (Math.PI / 2);

  dust.material.opacity = L(0.4, 0.5) * (1 - L(0.8, 1)) * 0.9;
  dust.rotation.y = k * 0.6;

  // camera starts close on the door and pulls back as the lights come on
  placeCamera(camera, {
    target: new THREE.Vector3(0, 2.6, 0.5),
    width: 22,
    height: 12,
    angle: 0.55 + k * 0.25,
    lift: 0.2,
    pull: lerp(0.9, 1.15, L(0.5, 0.9)),
  });

  return turn >= 1;
}
