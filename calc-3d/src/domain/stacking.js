// =============================================================================
// domain/stacking.js — кинематика стекинга. Чистый модуль: без three.
//
// Работает с plain-объектами: пятнами {x, z, w, d} и записями ItemRecord.
// Координаты: x/z — центр пятна на полу, y — высота НИЗА предмета (0 = пол).
// =============================================================================

import { ANIM } from '../config.js';

const EPS = ANIM.EPS;

// -----------------------------------------------------------------------------
// Геометрия пятен
// -----------------------------------------------------------------------------

// Пересекаются ли два пятна в плане.
// margin — буфер: положительное значение «раздувает» пятна (более строгая проверка).
export function overlapXZ(a, b, margin = 0) {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return dx < (a.w + b.w) / 2 + margin - EPS
      && dz < (a.d + b.d) / 2 + margin - EPS;
}

// Площадь пересечения пятен в плане (0, если не пересекаются)
function overlapAreaXZ(a, b) {
  const ox = Math.max(0, (a.w + b.w) / 2 - Math.abs(a.x - b.x));
  const oz = Math.max(0, (a.d + b.d) / 2 - Math.abs(a.z - b.z));
  return ox * oz;
}

// Помещается ли пятно inner целиком внутри пятна outer (допуск tol, м)
export function footprintInside(inner, outer, tol = 0.02) {
  const fitsX = Math.abs(inner.x - outer.x) + inner.w / 2 <= outer.w / 2 + tol + EPS;
  const fitsZ = Math.abs(inner.z - outer.z) + inner.d / 2 <= outer.d / 2 + tol + EPS;
  return fitsX && fitsZ;
}

// -----------------------------------------------------------------------------
// Вычисление опоры — сердце проекта
// -----------------------------------------------------------------------------

// Высота опоры под предметом при его текущих x/z.
// Возвращает { y, blocked }:
//  - y — высота низа предмета, при которой пересечений нет;
//  - blocked — позиция недопустима (на пути нескладываемый предмет, стеллаж
//    не принимает предмет, либо стек превышает потолок бокса).
// Кандидаты: пол (0), верх складываемых предметов (other.y + supportTop),
// полки стеллажа (shelf.y + level). Выбирается МАКСИМАЛЬНЫЙ кандидат,
// при котором предмет помещается под потолок: y + h <= boxH.
export function computeSupportY(item, items, boxH) {
  const candidates = [];
  let floorAvailable = true;

  for (const other of items) {
    if (other.id === item.id) continue;
    if (!overlapXZ(item, other)) continue;

    // Через нескладываемый предмет проходить нельзя — немедленный блок
    if (other.stackable === false) return { y: item.y, blocked: true };

    if (other.shelfLevels) {
      // Пол под стеллажом находится внутри него — кандидат «пол» снимаем
      floorAvailable = false;
      // Стеллаж принимает предмет, только если пятно целиком помещается
      // на полке; иначе стеллаж — препятствие и движение блокируется
      if (!footprintInside(item, other)) return { y: item.y, blocked: true };
      // Кандидаты — уровни полок, где хватает зазора до следующей полки
      for (let i = 0; i < other.shelfLevels.length; i += 1) {
        const level = other.shelfLevels[i];
        const isTop = i === other.shelfLevels.length - 1;
        // Верхний уровень полкой не ограничен — только высотой бокса (ниже)
        const gap = isTop ? Infinity : other.shelfLevels[i + 1] - level;
        if (item.h <= gap + EPS) candidates.push(other.y + level);
      }
    } else if (typeof other.supportTop === 'number') {
      // Обычный предмет: кандидат — его верхняя поверхность
      candidates.push(other.y + other.supportTop);
    }
  }

  // Пол — кандидат всегда, если пятно не перечёркнуто стеллажом
  if (floorAvailable) candidates.push(0);

  // Максимальный кандидат, при котором предмет не пробивает потолок
  let best = -Infinity;
  for (const y of candidates) {
    if (y + item.h <= boxH + EPS && y > best) best = y;
  }
  if (best === -Infinity) return { y: item.y, blocked: true };
  return { y: best, blocked: false };
}

// Опора «снизу»: максимальная поверхность НЕ ВЫШЕ низа предмета.
// Внутренняя функция settle-прохода — предметы только падают, не поднимаются.
// ys — карта высот: позволяет учитывать уже спроецированные падения (каскад).
function supportBelow(item, items, ys) {
  const bottom = ys.get(item.id);
  const candidates = [];
  let floorAvailable = true;

  for (const other of items) {
    if (other.id === item.id) continue;
    if (!overlapXZ(item, other)) continue;
    if (other.stackable === false) return { y: bottom, blocked: true };

    const otherY = ys.get(other.id);
    if (other.shelfLevels) {
      floorAvailable = false;
      if (!footprintInside(item, other)) continue;
      for (const level of other.shelfLevels) {
        const y = otherY + level;
        if (y <= bottom + EPS) candidates.push(y);
      }
    } else if (typeof other.supportTop === 'number') {
      const y = otherY + other.supportTop;
      if (y <= bottom + EPS) candidates.push(y);
    }
  }

  if (floorAvailable) candidates.push(0);

  let best = -Infinity;
  for (const y of candidates) {
    if (y > best) best = y;
  }
  if (best === -Infinity) return { y: bottom, blocked: true };
  return { y: best, blocked: false };
}

// -----------------------------------------------------------------------------
// Границы и settle-проход
// -----------------------------------------------------------------------------

// Обрезка координат предмета по стенам бокса в плане
export function clampToBounds(x, z, item, box) {
  const maxX = Math.max(0, box.w / 2 - item.w / 2);
  const maxZ = Math.max(0, box.d / 2 - item.d / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    z: Math.min(maxZ, Math.max(-maxZ, z))
  };
}

// Settle-проход: предметы, потерявшие опору и долженствующие упасть.
// Каскад обрабатывается снизу вверх: спроецированные высоты сразу пишутся
// в карту ys, поэтому «колонна» падает за один проход. Только вниз —
// подъёмов в settle не бывает.
export function findFallen(items) {
  const fallen = [];
  const ys = new Map(items.map(item => [item.id, item.y]));
  const sorted = [...items].sort((a, b) => a.y - b.y);

  for (const item of sorted) {
    const current = ys.get(item.id);
    const probe = { ...item, y: current };
    const support = supportBelow(probe, items, ys);
    if (!support.blocked && support.y < current - EPS) {
      ys.set(item.id, support.y);
      fallen.push({ id: item.id, toY: support.y });
    }
  }
  return fallen;
}

// -----------------------------------------------------------------------------
// Спавн
// -----------------------------------------------------------------------------

// Поиск свободной точки спавна внутри бокса.
// До SPAWN_ATTEMPTS случайных точек; каждая должна: (а) не пересекать другие
// предметы в плане, (б) проходить предикат isValid (менеджер передаёт
// «computeSupportY не blocked»). Fallback — точка с минимальным перекрытием,
// по возможности с валидной опорой.
export function findSpawnSpot(item, items, box, isValid) {
  const maxX = Math.max(0, box.w / 2 - item.w / 2);
  const maxZ = Math.max(0, box.d / 2 - item.d / 2);

  let fallback = { x: 0, z: 0 };
  let fallbackScore = Infinity;

  for (let attempt = 0; attempt < ANIM.SPAWN_ATTEMPTS; attempt += 1) {
    const x = (Math.random() * 2 - 1) * maxX;
    const z = (Math.random() * 2 - 1) * maxZ;
    const probe = { ...item, x, z };

    let overlap = 0;
    for (const other of items) overlap += overlapAreaXZ(probe, other);
    const valid = isValid(x, z);

    // Чистая точка с валидной опорой — возвращаем сразу
    if (overlap <= EPS && valid) return { x, z };

    // Оценка fallback-точки: площадь перекрытия + штраф за заблокированную опору
    const score = overlap + (valid ? 0 : 1e6);
    if (score < fallbackScore) {
      fallbackScore = score;
      fallback = { x, z };
    }
  }
  return fallback;
}