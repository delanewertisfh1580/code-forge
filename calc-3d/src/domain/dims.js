// =============================================================================
// domain/dims.js — производные параметры предмета от его габаритов (v1.1).
// Чистый модуль: без three. Пересчитывает объём, верхнюю поверхность опоры
// и уровни полок при пользовательском изменении размеров.
// =============================================================================

import { ITEM_TYPES, DIM_LIMITS, ANIM } from '../config.js';

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
//  - стеллаж получает 3 полки равномерно по высоте: при эталонных 1.8 м
//    это ровно 0.6 / 1.2 / 1.8. Визуальные полки в builders.js строятся
//    по этим же уровням, поэтому визуаль и кинематика всегда совпадают.
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