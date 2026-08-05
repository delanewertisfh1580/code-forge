// =============================================================================
// domain/pricing.js — рекомендация бокса по составу вещей.
// Чистый модуль: без three.
// =============================================================================

import { BOXES, ANIM } from '../config.js';

const EPS = ANIM.EPS;

// Проходит ли вещь в бокс по габаритам в естественной ориентации (без поворотов)
function fitsByDims(item, box) {
  return item.w <= box.w + EPS
      && item.d <= box.d + EPS
      && item.h <= box.h + EPS;
}

// Рекомендация по составу:
//  - { type: 'empty' }        — предметов нет;
//  - { type: 'box', box }     — первый бокс, проходящий по объёму И габаритам;
//  - { type: 'xl' }           — объём больше 27 м³ (нестандарт).
export function computeRecommendation(items, totalVolume) {
  if (items.length === 0) return { type: 'empty' };

  // Объём сверх максимальной сетки
  if (totalVolume > 27 + EPS) return { type: 'xl' };

  for (const box of BOXES) {
    if (totalVolume > box.volume + EPS) continue;
    if (items.every(item => fitsByDims(item, box))) {
      return { type: 'box', box };
    }
  }

  // Объём в пределах сетки, но габариты вещей не проходят ни в один бокс
  return { type: 'xl' };
}