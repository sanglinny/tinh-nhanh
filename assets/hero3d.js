// Homepage hero: three procedurally built objects (bolt, receipt, globe) on a point-grid floor.
// Loads only on the homepage; falls back to the static CSS gradient when WebGL is missing,
// the user prefers reduced motion, or the device reports very low memory.
import * as THREE from "three";

const host = document.getElementById("hero3d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowEnd = (navigator.deviceMemory && navigator.deviceMemory < 2);

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch { return false; }
}

if (host && webglOK() && !lowEnd) start();

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.2, 9);

  const accent = new THREE.Color(css("--accent") || "#0f766e");
  const warm = new THREE.Color("#f2b544");

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223330, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.PointLight(accent, 30, 20); rim.position.set(-5, 2, -2); scene.add(rim);

  const glass = (color, opts = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.25, metalness: 0.05, transmission: 0.35, thickness: 0.6,
    clearcoat: 1, clearcoatRoughness: 0.15, ...opts,
  });

  // Lightning bolt: extruded 2D outline.
  const bolt = (() => {
    const s = new THREE.Shape();
    [[0.15, 1], [-0.55, -0.1], [-0.05, -0.1], [-0.25, -1], [0.55, 0.15], [0.05, 0.15], [0.15, 1]]
      .forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 3 });
    g.center();
    return new THREE.Mesh(g, glass(warm, { transmission: 0.15 }));
  })();

  // Receipt: thin slab with a zig-zag bottom edge and raised "lines".
  const receipt = (() => {
    const w = 1.1, h = 1.5, s = new THREE.Shape();
    s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2); s.lineTo(w / 2, -h / 2);
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
      const x0 = w / 2 - (i * w) / teeth;
      s.lineTo(x0 - w / teeth / 2, -h / 2 + 0.12); s.lineTo(x0 - w / teeth, -h / 2);
    }
    s.lineTo(-w / 2, h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
    g.center();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(g, glass(0xffffff, { transmission: 0.1, roughness: 0.4 })));
    const lineMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
    [0.45, 0.22, 0, -0.22].forEach((y, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(i === 0 ? 0.7 : 0.55 - i * 0.06, 0.07, 0.03), lineMat);
      bar.position.set(i === 0 ? 0 : -0.1, y, 0.07);
      group.add(bar);
    });
    return group;
  })();

  // Globe: solid core + latitude/longitude wire shell.
  const globe = (() => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 32), glass(accent, { transmission: 0.45 })));
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.SphereGeometry(0.8, 16, 10)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    group.add(wire);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.025, 12, 96), new THREE.MeshStandardMaterial({ color: warm, roughness: 0.3, metalness: 0.4 }));
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
    return group;
  })();

  // sway: oscillate around facing the camera instead of spinning (a flat receipt seen edge-on reads as a sliver).
  // The globe is the subject (centre, larger); bolt and receipt are smaller accents.
  const items = [
    { obj: bolt, x: -1, y: 0.1, z: -0.8, spin: 0.3, size: 0.7 },
    { obj: globe, x: 0, y: 0.3, z: 0.3, spin: 0.15, size: 1.35 },
    { obj: receipt, x: 1, y: 0.15, z: -0.8, sway: 0.35, size: 0.7 },
  ];
  items.forEach((it) => { it.base = new THREE.Vector3(it.x * 2.6, it.y, it.z); });
  items.forEach((it, i) => { it.obj.position.copy(it.base); it.phase = i * 2.1; scene.add(it.obj); });

  // Point-grid floor with a slow wave.
  const N = 56, size = 16;
  const pos = new Float32Array(N * N * 3);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = (i * N + j) * 3;
    pos[k] = (i / (N - 1) - 0.5) * size; pos[k + 1] = -1.6; pos[k + 2] = (j / (N - 1) - 0.5) * size;
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const floor = new THREE.Points(floorGeo, new THREE.PointsMaterial({ color: accent, size: 0.045, transparent: true, opacity: 0.55 }));
  scene.add(floor);

  const pointer = { x: 0, y: 0 };
  host.addEventListener("pointermove", (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow screens: bring the objects closer together and enlarge them instead of
    // pulling the camera back (which made them tiny).
    const narrow = w < 600;
    const spread = narrow ? 1.45 : 2.6, scale = narrow ? 0.9 : 1;
    items.forEach((it) => { it.base.x = it.x * spread; it.obj.position.x = it.base.x; it.obj.scale.setScalar(scale * (it.size || 1)); });
    camera.position.z = narrow ? 7.2 : 9;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const motion = reduce ? 0 : 1;
    items.forEach((it) => {
      it.obj.rotation.y = it.sway != null
        ? Math.sin(t * 0.7 + it.phase) * it.sway * motion
        : it.phase + t * it.spin * motion;
      it.obj.rotation.x = Math.sin(t * 0.5 + it.phase) * 0.08 * motion;
      it.obj.position.y = it.base.y + Math.sin(t * 0.7 + it.phase) * 0.08 * motion;
    });
    const p = floorGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) p[i + 1] = -1.6 + Math.sin(p[i] * 0.55 + t * 0.8 * motion) * Math.cos(p[i + 2] * 0.45 + t * 0.6 * motion) * 0.22;
    floorGeo.attributes.position.needsUpdate = true;
    camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (1.2 - pointer.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  frame();
  host.classList.add("is-3d");
}
