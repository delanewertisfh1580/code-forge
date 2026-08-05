// =============================================================================
// items/builders.js — построители геометрии предметов.
// Каждый билдер возвращает ОДИН BufferGeometry (mergeGeometries) с началом
// координат в центре основания (min.y = 0) — это критично для стекинга.
// Никаких внешних моделей: только базовые примитивы Three.js.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ящик с центром в точке (x, y, z); y — высота ЦЕНТРА детали
function makeBox(w, h, d, x, y, z) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

// Колесо: цилиндр с осью вдоль X
function makeWheel(r, thickness, x, y, z) {
  const geometry = new THREE.CylinderGeometry(r, r, thickness, 24);
  geometry.rotateZ(Math.PI / 2); // ось цилиндра Y → X
  geometry.translate(x, y, z);
  return geometry;
}

// Склейка деталей и привязка начала координат к центру основания:
// после mergeGeometries сдвигаем геометрию так, чтобы min.y стало равно 0
function finalize(parts) {
  const merged = mergeGeometries(parts);
  merged.computeBoundingBox();
  merged.translate(0, -merged.boundingBox.min.y, 0);
  return merged;
}

// --- Коробка 0,5 × 0,5 × 0,5 со «скотчем» сверху ---
function buildBox() {
  return finalize([
    makeBox(0.5, 0.5, 0.5, 0, 0.25, 0),  // корпус
    makeBox(0.5, 0.012, 0.1, 0, 0.5, 0), // полоска скотча поперёк
    makeBox(0.1, 0.012, 0.5, 0, 0.5, 0)  // полоска скотча вдоль
  ]);
}

// --- Диван 2 × 1 × 1; опора (сиденье) на y = 0.56 ---
function buildSofa() {
  return finalize([
    makeBox(2, 0.42, 1, 0, 0.21, 0),              // основание
    makeBox(2, 0.6, 0.24, 0, 0.7, -0.38),         // спинка (верх ровно на y = 1.0)
    makeBox(0.24, 0.32, 1, -0.88, 0.58, 0),       // левый подлокотник
    makeBox(0.24, 0.32, 1, 0.88, 0.58, 0),        // правый подлокотник
    makeBox(0.76, 0.14, 0.76, -0.38, 0.49, 0.12), // левая подушка сиденья
    makeBox(0.76, 0.14, 0.76, 0.38, 0.49, 0.12)   // правая подушка (верх 0.56)
  ]);
}

// --- Велосипед: модель ориентирована вдоль оси Z (габарит 0.5 × 1.5 × 1) ---
function buildBike() {
  return finalize([
    makeWheel(0.32, 0.05, 0, 0.32, -0.42),    // заднее колесо
    makeWheel(0.32, 0.05, 0, 0.32, 0.42),     // переднее колесо
    makeBox(0.06, 0.08, 0.84, 0, 0.36, 0),    // рама-брус вдоль Z
    makeBox(0.05, 0.4, 0.05, 0, 0.56, -0.18), // подседельный штырь
    makeBox(0.14, 0.05, 0.3, 0, 0.78, -0.18), // сиденье
    makeBox(0.05, 0.5, 0.05, 0, 0.6, 0.32),   // рулевая стойка
    makeBox(0.5, 0.05, 0.05, 0, 0.86, 0.32)   // руль (габарит по X ≤ 0.5)
  ]);
}

// --- Холодильник 0.8 × 0.8 × 1.8 ---
function buildFridge() {
  return finalize([
    makeBox(0.78, 1.8, 0.72, 0, 0.9, 0),         // корпус
    makeBox(0.02, 1.6, 0.02, 0, 0.95, 0.36),     // шов между дверцами
    makeBox(0.03, 0.5, 0.03, -0.15, 1.0, 0.375), // левая ручка
    makeBox(0.03, 0.5, 0.03, 0.15, 1.0, 0.375)   // правая ручка (не выходит за габарит 0.8)
  ]);
}

// --- Стеллаж 1 × 0.6 × 1.8 ---
function buildShelf() {
  const parts = [
    makeBox(0.05, 1.8, 0.6, -0.475, 0.9, 0),   // левая боковина
    makeBox(0.05, 1.8, 0.6, 0.475, 0.9, 0),    // правая боковина
    makeBox(0.94, 1.74, 0.02, 0, 0.87, -0.29), // задняя стенка
    makeBox(0.9, 0.04, 0.6, 0, 0.08, 0)        // декоративная нижняя полка
  ];
  // Несущие полки: ВЕРХНЯЯ поверхность каждой ровно на y из shelfLevels,
  // чтобы визуаль совпадала с кинематикой стекинга из config
  for (const level of [0.6, 1.2, 1.8]) {
    parts.push(makeBox(0.9, 0.04, 0.6, 0, level - 0.02, 0));
  }
  return finalize(parts);
}

// Карта построителей по типам предметов
export const BUILDERS = {
  box: buildBox,
  sofa: buildSofa,
  bike: buildBike,
  fridge: buildFridge,
  shelf: buildShelf
};