// =============================================================================
// items/builders.js — построители геометрии предметов (v1.1: параметрические).
// Каждый билдер принимает габариты (w — X, d — Z, h — Y) и возвращает ОДИН
// BufferGeometry (mergeGeometries) с началом координат в центре основания
// (min.y = 0) — это критично для стекинга. Стеллаж дополнительно принимает
// список уровней полок: визуальные доски строятся ровно по этим уровням,
// толщина доски — единый источник SHELF_LIMITS.SHELF_BOARD из config.
// Никаких внешних моделей: только базовые примитивы Three.js.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHELF_LIMITS } from '../config.js';

const SHELF_BOARD = SHELF_LIMITS.SHELF_BOARD; // толщина доски полки

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

// --- Коробка w × d × h со «скотчем» сверху ---
function buildBox(w, d, h) {
  return finalize([
    makeBox(w, h, d, 0, h / 2, 0),        // корпус
    makeBox(w, 0.012, d * 0.2, 0, h, 0),  // полоска скотча поперёк
    makeBox(w * 0.2, 0.012, d, 0, h, 0)   // полоска скотча вдоль
  ]);
}

// --- Диван: пропорции эталона 2 × 1 × 1, сиденье (опора) на 0.56·h ---
function buildSofa(w, d, h) {
  const armW = 0.12 * w;            // подлокотник — 12% ширины
  const cushW = (w - 2 * armW) / 2; // подушка — половина зоны сиденья
  const cushD = 0.76 * d;           // глубина подушки (без спинки)
  return finalize([
    makeBox(w, 0.42 * h, d, 0, 0.21 * h, 0),                       // основание
    makeBox(w, 0.6 * h, 0.24 * d, 0, 0.7 * h, -0.38 * d),          // спинка (верх = h)
    makeBox(armW, 0.32 * h, d, -(w / 2 - armW / 2), 0.58 * h, 0),  // левый подлокотник
    makeBox(armW, 0.32 * h, d, w / 2 - armW / 2, 0.58 * h, 0),     // правый подлокотник
    makeBox(cushW, 0.14 * h, cushD, -cushW / 2, 0.49 * h, 0.12 * d), // левая подушка
    makeBox(cushW, 0.14 * h, cushD, cushW / 2, 0.49 * h, 0.12 * d)   // правая (верх 0.56·h)
  ]);
}

// --- Велосипед: эталонная модель вдоль Z, масштабируется под новый габарит ---
function buildBike(w, d, h) {
  // Эталон 0.5 × 1.5 × 1: колёса r=0.32, рама, сиденье, руль ≤0.5 по X
  const merged = mergeGeometries([
    makeWheel(0.32, 0.05, 0, 0.32, -0.42),    // заднее колесо
    makeWheel(0.32, 0.05, 0, 0.32, 0.42),     // переднее колесо
    makeBox(0.06, 0.08, 0.84, 0, 0.36, 0),    // рама-брус вдоль Z
    makeBox(0.05, 0.4, 0.05, 0, 0.56, -0.18), // подседельный штырь
    makeBox(0.14, 0.05, 0.3, 0, 0.78, -0.18), // сиденье
    makeBox(0.05, 0.5, 0.05, 0, 0.6, 0.32),   // рулевая стойка
    makeBox(0.5, 0.05, 0.05, 0, 0.86, 0.32)   // руль
  ]);
  // Растягиваем эталон под новые габариты (допустимо для low-poly демо)
  merged.scale(w / 0.5, h / 1, d / 1.5);
  merged.computeBoundingBox();
  merged.translate(0, -merged.boundingBox.min.y, 0);
  return merged;
}

// --- Холодильник: корпус чуть уже габарита, ручки не выходят за пределы ---
function buildFridge(w, d, h) {
  const bw = 0.975 * w;                       // корпус по ширине
  const bd = 0.9 * d;                         // корпус по глубине
  const hz = Math.min(bd / 2 + 0.015, d / 2 - 0.015); // ручки внутри габарита
  const handleH = Math.min(0.5, 0.3 * h);     // высота ручек
  const handleX = 0.1875 * w;                 // ±0.15 у эталона шириной 0.8
  return finalize([
    makeBox(bw, h, bd, 0, h / 2, 0),                      // корпус
    makeBox(0.02, 0.9 * h, 0.02, 0, 0.53 * h, bd / 2),    // шов между дверцами
    makeBox(0.03, handleH, 0.03, -handleX, 0.56 * h, hz), // левая ручка
    makeBox(0.03, handleH, 0.03, handleX, 0.56 * h, hz)   // правая ручка
  ]);
}

// --- Стеллаж: боковины, задняя стенка и доски по списку уровней levels (v1.1.1) ---
function buildShelf(w, d, h, levels) {
  const side = Math.min(0.05, w / 4); // боковина (не толще четверти ширины)
  const shelfW = w - 2 * side;        // доска между боковинами
  // Список уровней: пользовательский либо 3 полки равномерно по умолчанию
  const boards = Array.isArray(levels) && levels.length > 0
    ? [...levels].sort((a, b) => a - b)
    : [h / 3, (2 * h) / 3, h];
  const parts = [
    makeBox(side, h, d, -(w / 2 - side / 2), h / 2, 0), // левая боковина
    makeBox(side, h, d, w / 2 - side / 2, h / 2, 0),    // правая боковина
    // Задняя стенка
    makeBox(w - 0.06, h - 0.06, 0.02, 0, (h - 0.06) / 2, -(d / 2 - 0.01)),
    // Декоративная нижняя полка
    makeBox(shelfW, SHELF_BOARD, d, 0, Math.min(0.08, h / 4), 0)
  ];
  // Несущие доски: ВЕРХНЯЯ поверхность каждой ровно на уровне из levels —
  // те же числа, что использует кинематика стекинга (shelfLevels записи)
  for (const level of boards) {
    parts.push(makeBox(shelfW, SHELF_BOARD, d, 0, level - SHELF_BOARD / 2, 0));
  }
  return finalize(parts);
}

// Карта построителей по типам предметов: (w, d, h, levels?) → BufferGeometry
export const BUILDERS = {
  box: buildBox,
  sofa: buildSofa,
  bike: buildBike,
  fridge: buildFridge,
  shelf: buildShelf
};