// =============================================================================
// scene/renderer.js — инициализация 3D-сцены: рендерер, камера, свет, пол.
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE } from '../config.js';

// Создаёт сцену: рендерер, камеру, орбиту, свет, пол и сетку.
// Возвращает { renderer, scene, camera, orbit, onResize }.
export function initScene(canvas) {
  // --- Рендерер ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // ≤2 — экономия производительности
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // мягкие тени
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // --- Сцена: тёмный фон и туман ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE.background);
  scene.fog = new THREE.Fog(SCENE.background, SCENE.fog.near, SCENE.fog.far);

  // --- Камера ---
  const camera = new THREE.PerspectiveCamera(
    SCENE.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(
    SCENE.camera.position.x,
    SCENE.camera.position.y,
    SCENE.camera.position.z
  );

  // --- OrbitControls: демпфирование и ограничения из config ---
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.enablePan = false;
  orbit.minDistance = SCENE.orbit.minDistance;
  orbit.maxDistance = SCENE.orbit.maxDistance;
  orbit.maxPolarAngle = SCENE.orbit.maxPolarAngle; // камера не уходит под пол
  orbit.target.set(SCENE.orbit.target.x, SCENE.orbit.target.y, SCENE.orbit.target.z);
  orbit.update();

  // --- Свет ---
  // Полусферный: мягкая подсветка «небом» и «землёй»
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x11141a, 0.65);
  scene.add(hemi);

  // Ключевой направленный свет с тенями
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(6, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  scene.add(key);

  // Заполняющий свет — холодная синяя подсветка сзади
  const fill = new THREE.DirectionalLight(0x5577ff, 0.35);
  fill.position.set(-6, 4, -6);
  scene.add(fill);

  // --- Пол: принимает тени ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x171b23, roughness: 0.96, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- Сетка чуть выше пола, чтобы избежать z-fighting ---
  const grid = new THREE.GridHelper(26, 26, 0x2f3b55, 0x1e2431);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = 0.001;
  scene.add(grid);

  // --- Ресайз окна ---
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, orbit, onResize };
}