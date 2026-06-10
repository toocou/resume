/* ============================================================
   Hero scene — three.js particle wave field
   A dark topographic plane of points, gently displaced by
   layered sine noise, with a soft repulsion around the cursor.
   ============================================================ */
import * as THREE from '../vendor/three.module.min.js';

const canvas = document.getElementById('heroCanvas');
const hero = document.getElementById('hero');
if (!canvas || !hero) throw new Error('hero canvas missing');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 900px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 2.6, 5.2);
camera.lookAt(0, 0, -1);

/* ---- Points grid ---- */
const COLS = isMobile ? 110 : 190;
const ROWS = isMobile ? 70 : 110;
const WIDTH = 16;
const DEPTH = 10;

const count = COLS * ROWS;
const positions = new Float32Array(count * 3);
const seeds = new Float32Array(count);

let i = 0;
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    positions[i * 3] = (c / (COLS - 1) - 0.5) * WIDTH;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = (r / (ROWS - 1) - 0.5) * DEPTH;
    seeds[i] = Math.random();
    i++;
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

const uniforms = {
  uTime: { value: 0 },
  uMouse: { value: new THREE.Vector2(99, 99) }, // offscreen until first move
  uPixelRatio: { value: renderer.getPixelRatio() },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uPixelRatio;
    attribute float aSeed;
    varying float vElev;
    varying float vSeed;
    varying float vDist;

    void main() {
      vec3 p = position;

      // Layered travelling waves — calm, topographic
      float t = uTime * 0.45;
      float elev =
          sin(p.x * 0.55 + t)        * 0.45
        + sin(p.z * 0.85 + t * 1.4)  * 0.30
        + sin((p.x + p.z) * 0.35 - t * 0.8) * 0.35
        + sin(p.x * 1.7 + p.z * 1.3 + t * 2.0) * 0.08;

      // Cursor repulsion (mouse in plane space)
      float d = distance(p.xz, uMouse);
      float push = smoothstep(2.2, 0.0, d);
      elev += push * 0.9;

      p.y = elev;
      vElev = elev;
      vSeed = aSeed;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.4 + aSeed * 1.3 + push * 2.2) * uPixelRatio * (4.6 / vDist);
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vElev;
    varying float vSeed;
    varying float vDist;

    void main() {
      // Round point sprite
      float r = length(gl_PointCoord - 0.5);
      if (r > 0.5) discard;
      float alpha = smoothstep(0.5, 0.18, r);

      // Bone-white base, signal-orange crests
      vec3 bone = vec3(0.62, 0.61, 0.58);
      vec3 accent = vec3(1.0, 0.30, 0.0);
      float crest = smoothstep(0.35, 1.15, vElev);
      vec3 color = mix(bone, accent, crest * (0.55 + vSeed * 0.45));

      // Fade with distance + overall subtlety
      float fade = smoothstep(12.0, 4.0, vDist);
      gl_FragColor = vec4(color, alpha * fade * 0.85);
    }
  `,
});

const points = new THREE.Points(geometry, material);
points.position.z = -1.5;
scene.add(points);

/* ---- Mouse → plane-space target with easing ---- */
const mouseTarget = new THREE.Vector2(99, 99);
window.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  if (e.clientY < rect.top || e.clientY > rect.bottom) return;
  const nx = (e.clientX / rect.width) * 2 - 1;
  const ny = (e.clientY - rect.top) / rect.height;
  mouseTarget.set(nx * WIDTH * 0.5, (ny - 0.35) * DEPTH * 0.9);
}, { passive: true });

/* ---- Resize ---- */
const resize = () => {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  uniforms.uPixelRatio.value = renderer.getPixelRatio();
};
resize();
window.addEventListener('resize', resize);

/* ---- Render loop (paused when hero offscreen / tab hidden) ---- */
let visible = true;
let rafId = null;
const clock = new THREE.Clock();

const renderFrame = () => {
  uniforms.uTime.value = clock.getElapsedTime();
  uniforms.uMouse.value.lerp(mouseTarget, 0.06);
  renderer.render(scene, camera);
};

const loop = () => {
  renderFrame();
  rafId = requestAnimationFrame(loop);
};

const setRunning = (run) => {
  if (run && rafId === null && !prefersReducedMotion) {
    clock.start();
    rafId = requestAnimationFrame(loop);
  } else if (!run && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  setRunning(visible && !document.hidden);
}, { threshold: 0.01 }).observe(hero);

document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));

if (prefersReducedMotion) {
  // Single static frame
  uniforms.uTime.value = 12;
  renderFrame();
} else {
  setRunning(true);
}
