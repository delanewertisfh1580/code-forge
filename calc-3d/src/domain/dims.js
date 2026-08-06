// =============================================================================
// domain/dims.js — производные параметры предмета от его габаритов (v1.1).
// Чистый модуль: без three. Пересчитывает объём, верхнюю поверхность опоры
// и уровни полок при пользовательском изменении размеров.
// =============================================================================

import { ITEM_TYPES, DIM_LIMITS, SHELF_LIMITS, ANIM } from '../config.js';

const EPS = ANIM.EPS;

// Проверка габаритов: конечные числа в допустимых пределах DIM_LIMITS
export function isValidDims(w, d, h) {
  return [w, d, h].every(v =>
    Number.isFinite(v) && v >= DIM_LIMITS.MIN - EPS && v <= DIM_LIMITS.MAX + EPS
  );
}

// Округление объёма до миллиметров (защита от хвостов плавающей точки)
export function roundVolume(value) {
  return Math.round(value * 1000) / 1000;
}

// Производные параметры от новых габаритов:
//  - объём = w·d·h;
//  - supportTop масштабируется вместе с высотой эталона:
//    коробка и холодильник (ratio = 1) → верх h; диван (ratio = 0.56) → сиденье;
//    велосипед остаётся без опоры (supportTop = null);
//  - стеллаж по умолчанию получает 3 полки равномерно по высоте: при 1.8 м
//    это ровно 0.6 / 1.2 / 1.8. Пользовательская конфигурация полок (v1.1.1)
//    живёт в записи предмета и обрабатывается scaleShelfLevels.
export function deriveItemProps(type, w, d, h) {
  const cfg = ITEM_TYPES[type];
  const props = {
    w, d, h,
    volume: roundVolume(w * d * h),
    supportTop: null,
    shelfLevels: null
  };

  if (cfg.shelfLevels) {
    // Стеллаж: уровни полок — доли от новой высоты
    props.shelfLevels = [h / 3, (2 * h) / 3, h];
  } else if (typeof cfg.supportTop === 'number') {
    // Обычный предмет: опора пропорциональна эталонной высоте
    props.supportTop = roundVolume((cfg.supportTop / cfg.h) * h);
  }
  // Велосипед: supportTop остаётся null — сверху ничего не ставить

  return props;
}

// -----------------------------------------------------------------------------
// Полки стеллажа (v1.1.1)
// -----------------------------------------------------------------------------

// Проверка списка уровней полок для стеллажа высоты h:
// непустой список не длиннее MAX_LEVELS, уровни по возрастанию,
// каждый в диапазоне [MIN_LEVEL, h], соседние с зазором не меньше MIN_GAP
export function isValidShelfLevels(levels, h) {
  if (!Array.isArray(levels) || levels.length === 0) return false;
  if (levels.length > SHELF_LIMITS.MAX_LEVELS) return false;
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    if (!Number.isFinite(level)) return false;
    if (level < SHELF_LIMITS.MIN_LEVEL - EPS) return false;
    if (level > h + EPS) return false;
    if (i > 0 && level - levels[i - 1] < SHELF_LIMITS.MIN_GAP - EPS) return false;
  }
  return true;
}

// Масштабирование уровней при изменении высоты стеллажа: пользовательская
// конфигурация полок сохраняется пропорционально новой высоте
export function scaleShelfLevels(levels, oldH, newH) {
  if (!Array.isArray(levels) || levels.length === 0 || oldH <= EPS) {
    return [newH / 3, (2 * newH) / 3, newH];
  }
  const k = newH / oldH;
  return levels.map(level => roundVolume(level * k));
}