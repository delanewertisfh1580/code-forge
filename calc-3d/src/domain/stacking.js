// =============================================================================
// domain/stacking.js — кинематика стекинга. Чистый модуль: без three.
//
// Работает с plain-объектами: пятнами {x, z, w, d} и записями ItemRecord.
// Координаты: x/z — центр пятна на полу, y — высота НИЗА предмета (0 = пол).
// =============================================================================

import { ANIM, SHELF_LIMITS } from '../config.js';

const EPS = ANIM.EPS;
const SHELF_BOARD = SHELF_LIMITS.SHELF_BOARD; // толщина доски полки

// Пересекаются ли два пятна в плане (margin «раздувает» пятна)
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

// Помещается ли пятно inner целиком внутри outer (допуск tol, м)
export function footprintInside(inner, outer, tol = 0.02) {
  const fitsX = Math.abs(inner.x - outer.x) + inner.w / 2 <= outer.w / 2 + tol + EPS;
  const fitsZ = Math.abs(inner.z - outer.z) + inner.d / 2 <= outer.d / 2 + tol + EPS;
  return fitsX && fitsZ;
}

// Предмет [y, y+h] в пятне other не задевает тело other (v1.1.1 — фикс прохлёста):
//  - стеллаж: тело — доски полок [level − SHELF_BOARD, level]; предмет проходит
//    выше полки (y >= level) либо целиком ниже её доски;
//  - обычный предмет: тело занимает зону от низа до опоры supportTop (выше —
//    «воздух», абстракция посадки на сиденье); предмет проходит на опоре/выше
//    либо целиком ниже предмета.
function clearsBody(y, item, other) {
  if (other.shelfLevels) {
    for (const level of other.shelfLevels) {
      const above = y >= other.y + level - EPS;
      const below = y + item.h <= other.y + level - SHELF_BOARD + EPS;
      if (!above && !below) return false;
    }
    return true;
  }
  const usableTop = other.y + (typeof other.supportTop === 'number' ? other.supportTop : other.h);
  return y >= usableTop - EPS || y + item.h <= other.y + EPS;
}

// Кандидат y безопасен: не задевает ни один предмет, пересекающий пятно
function clearsAllBodies(y, item, items) {
  for (const other of items) {
    if (other.id === item.id) continue;
    if (!overlapXZ(item, other)) continue;
    if (!clearsBody(y, item, other)) return false;
  }
  return true;
}

// Высота опоры под предметом при его текущих x/z. Возвращает { y, blocked }.
// Кандидаты: пол (0), верх складываемых предметов, полки стеллажа.
// Выбирается МАКСИМАЛЬНЫЙ кандидат, при котором предмет помещается под
// потолок И не пересекает ни одно тело: «запасного» спуска на занятую
// поверхность нет — только blocked и откат к последней валидной точке.
export function computeSupportY(item, items, boxH) {
  const candidates = [];
  let floorAvailable = true;

  for (const other of items) {
    if (other.id === item.id) continue;
    if (!overlapXZ(item, other)) continue;

    // Через нескладываемый предмет проходить нельзя — немедленный блок
    if (other.stackable === false) return { y: item.y, blocked: true };

    if (other.shelfLevels) {
      // Пол под стеллажом внутри него — кандидат «пол» снимаем
      floorAvailable = false;
      // Пятно должно целиком помещаться на полке, иначе стеллаж — препятствие
      if (!footprintInside(item, other)) return { y: item.y, blocked: true };
      // Кандидаты — уровни полок, где хватает зазора до следующей полки
      for (let i = 0; i < other.shelfLevels.length; i += 1) {
        const level = other.shelfLevels[i];
        const isTop = i === other.shelfLevels.length - 1;
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

  // Отбор: потолок + отсутствие пересечений; берём максимум подходящих
  let best = -Infinity;
  for (const y of candidates) {
    if (y + item.h > boxH + EPS) continue;
    if (!clearsAllBodies(y, item, items)) continue;
    if (y > best) best = y;
  }
  if (best === -Infinity) return { y: item.y, blocked: true };
  return { y: best, blocked: false };
}

// Опора «снизу»: максимальная поверхность НЕ ВЫШЕ низа предмета.
// Внутренняя функция settle-прохода — предметы только падают, не поднимаются.
// ys — карта высот: учитывает уже спроецированные падения (каскад).
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
// Каскад снизу вверх: спроецированные высоты пишутся в карту ys, поэтому
// «колонна» падает за один проход. Только вниз — подъёмов не бывает.
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

// Reflow-проход (v1.1): пересборка стека после смены габаритов/полок.
// В отличие от findFallen допускает и подъём (опора выросла — предмет едет
// вверх). Каскад снизу вверх на копии массива. Возвращает { ok, moves }:
// ok=false, если хотя бы один предмет некуда поставить, — изменение откатывается.
export function findReflow(items, boxH) {
  const moves = [];
  const snapshot = items.map(item => ({ ...item }));
  snapshot.sort((a, b) => a.y - b.y);

  for (const item of snapshot) {
    const support = computeSupportY(item, snapshot, boxH);
    if (support.blocked) return { ok: false, moves: [] };
    if (Math.abs(support.y - item.y) > EPS) {
      item.y = support.y; // следующие предметы увидят новую высоту опоры
      moves.push({ id: item.id, toY: support.y });
    }
  }
  return { ok: true, moves };
}

// Поиск свободной точки спавна внутри бокса: до SPAWN_ATTEMPTS случайных
// точек, каждая без 2D-перекрытий и с валидной опорой (предикат isValid).
// Fallback — точка с минимальным перекрытием, по возможности с валидной опорой.
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

    // Оценка fallback-точки: площадь перекрытия + штраф за блокировку опоры
    const score = overlap + (valid ? 0 : 1e6);
    if (score < fallbackScore) {
      fallbackScore = score;
      fallback = { x, z };
    }
  }
  return fallback;
}