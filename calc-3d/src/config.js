// =============================================================================
// config.js — единый источник правды: тарифы, типы предметов, сцена, анимации
// Все остальные модули берут данные только отсюда.
// =============================================================================

// Тарифная сетка (зафиксирована в ТЗ — не менять)
export const BOXES = [
  { id: 'S', w: 1, d: 1.5, h: 2,   volume: 3,  price: 3000 },
  { id: 'M', w: 2, d: 2,   h: 2.5, volume: 10, price: 7000 },
  { id: 'L', w: 3, d: 3,   h: 3,   volume: 27, price: 15000 }
];

// Габариты бокса для пустой сцены (и максимально возможный размер)
export const MAX_BOX = { w: 3, d: 3, h: 3 };

// CTA-кнопка «Забронировать бокс»
export const CTA_URL = 'https://t.me/Sagat9881';

// Библиотека предметов.
// w — ось X, d — ось Z, h — ось Y. Велосипед ориентирован вдоль Z специально:
// так он помещается в узкий бокс S. Ориентацию НЕ менять.
export const ITEM_TYPES = {
  box: {
    label: 'Коробка', emoji: '📦',
    w: 0.5, d: 0.5, h: 0.5, volume: 0.125,
    color: 0xC9955C, roughness: 0.92, metalness: 0.0,
    stackable: true, supportTop: 0.5, shelfLevels: null,
    dimsLabel: '0,5 × 0,5 × 0,5 м'
  },
  sofa: {
    label: 'Диван', emoji: '🛋️',
    w: 2, d: 1, h: 1, volume: 2,
    color: 0x5B7DB1, roughness: 0.88, metalness: 0.0,
    stackable: true, supportTop: 0.56, shelfLevels: null, // опора — только сиденье
    dimsLabel: '2 × 1 × 1 м'
  },
  bike: {
    label: 'Велосипед', emoji: '🚲',
    w: 0.5, d: 1.5, h: 1, volume: 0.75,
    color: 0x45B39D, roughness: 0.5, metalness: 0.35,
    stackable: false, supportTop: null, shelfLevels: null, // не опора, сверху ничего не ставить
    dimsLabel: '0,5 × 1,5 × 1 м'
  },
  fridge: {
    label: 'Холодильник', emoji: '🧊',
    w: 0.8, d: 0.8, h: 1.8, volume: 1.15,
    color: 0xB8C4D0, roughness: 0.35, metalness: 0.5,
    stackable: true, supportTop: 1.8, shelfLevels: null,
    dimsLabel: '0,8 × 0,8 × 1,8 м'
  },
  shelf: {
    label: 'Стеллаж', emoji: '🗄️',
    w: 1.0, d: 0.6, h: 1.8, volume: 1.08,
    color: 0x8A93A6, roughness: 0.6, metalness: 0.35,
    // Поверхности полок задаются списком уровней, а не supportTop
    stackable: true, supportTop: null, shelfLevels: [0.6, 1.2, 1.8],
    dimsLabel: '1 × 0,6 × 1,8 м'
  }
};

// Настройки сцены, камеры и OrbitControls
export const SCENE = {
  background: 0x12151b,
  fog: { near: 20, far: 45 },
  accent: 0x0066FF,
  camera: { fov: 45, position: { x: 6.2, y: 4.6, z: 7.2 } },
  orbit: {
    target: { x: 0, y: 0.9, z: 0 },
    minDistance: 3.5,
    maxDistance: 16,
    // Камера не уходит под пол
    maxPolarAngle: Math.PI / 2 - 0.05
  }
};

// Константы анимаций и вычислений
export const ANIM = {
  SPAWN_DURATION: 0.35, // появление предмета (easeOutBack), сек
  DROP_DURATION: 0.4,   // падение предмета (easeOutBounce), сек
  EPS: 1e-6,            // эпсилон сравнения высот/объёмов
  SPAWN_ATTEMPTS: 25    // попыток поиска свободной точки спавна
};

// Пределы пользовательских габаритов предметов (v1.1 — конфигурация размеров).
// MIN/MAX — допустимый диапазон по каждой оси, STEP — шаг полей ввода.
export const DIM_LIMITS = { MIN: 0.1, MAX: 6, STEP: 0.05 };

// Стеллаж и его полки (v1.1.1 — индивидуальная настройка полок).
// SHELF_BOARD — толщина доски полки: единый источник для builders (визуаль)
//   и stacking (кинематика), чтобы визуаль и физика всегда совпадали.
// MIN_LEVEL  — минимальная высота полки от низа стеллажа;
// MIN_GAP    — минимальный зазор между соседними полками;
// MAX_LEVELS — максимальное число полок;
// ADD_STEP   — на какой высоте над последней полкой создаётся новая по кнопке «+».
export const SHELF_LIMITS = {
  SHELF_BOARD: 0.04,
  MIN_LEVEL: 0.1,
  MIN_GAP: 0.05,
  MAX_LEVELS: 6,
  ADD_STEP: 0.4
};