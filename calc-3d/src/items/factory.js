// =============================================================================
// items/factory.js — создание и утилизация мешей предметов.
// Предмет — всегда ОДИН Mesh (из mergeGeometries), а не Group:
// иначе DragControls подхватит дочерние меши и сломает перетаскивание.
// =============================================================================

import * as THREE from 'three';
import { BUILDERS } from './builders.js';
import { ITEM_TYPES, SCENE } from '../config.js';

// Создать меш предмета по типу. userData.id связывает меш с записью в state.
export function createItemMesh(type, id) {
  const cfg = ITEM_TYPES[type];
  const mesh = new THREE.Mesh(
    BUILDERS[type](),
    new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: cfg.roughness,
      metalness: cfg.metalness
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.id = id;
  return mesh;
}

// Освобождение ресурсов — обязательно при удалении предмета
export function disposeMesh(mesh) {
  if (!mesh) return;
  mesh.geometry.dispose();
  mesh.material.dispose();
}

// Подсветка emissive-цветом акцента: 0.35 — hover, 0.5 — перетаскивание, 0 — сброс
export function setEmissive(mesh, intensity) {
  if (!mesh || !mesh.material) return;
  mesh.material.emissive.setHex(SCENE.accent);
  mesh.material.emissiveIntensity = intensity;
}