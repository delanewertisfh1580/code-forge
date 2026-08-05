// =============================================================================
// items/animation.js — анимации предметов: появление и падение.
// Реестр Map<id, anim>: у предмета не больше одной активной анимации;
// новая анимация по id отменяет предыдущую (конфликты исключены).
// =============================================================================

import { ANIM } from '../config.js';

const animations = new Map(); // id → активная анимация

// --- Функции сглаживания ---

// Упругий «перелёт» для появления
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Отскок в конце падения
function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// Появление: масштаб 0.01 → 1 с упругим перелётом (easeOutBack)
export function startSpawn(mesh) {
  animations.set(mesh.userData.id, {
    kind: 'spawn',
    mesh,
    t: 0,
    duration: ANIM.SPAWN_DURATION
  });
  mesh.scale.setScalar(0.01);
}

// Падение: y от текущего к toY с отскоком (easeOutBounce).
// Отменяет предыдущую анимацию этого id. По завершении record.y = toY.
export function startDrop(mesh, record, toY) {
  animations.set(mesh.userData.id, {
    kind: 'drop',
    mesh,
    record,
    fromY: mesh.position.y,
    toY,
    t: 0,
    duration: ANIM.DROP_DURATION
  });
}

// Отменить анимацию предмета (например, падающий предмет схватили мышью)
export function cancel(id) {
  animations.delete(id);
}

// Отменить все анимации (используется при очистке сцены)
export function cancelAll() {
  animations.clear();
}

// Занят ли предмет активной анимацией
export function isBusy(id) {
  return animations.has(id);
}

// Продвижение всех активных анимаций; вызывается каждый кадр.
// Пишет напрямую в mesh.scale / mesh.position.y.
export function update(dt) {
  for (const [id, anim] of animations) {
    anim.t += dt;
    const progress = Math.min(1, anim.t / anim.duration);

    if (anim.kind === 'spawn') {
      anim.mesh.scale.setScalar(0.01 + 0.99 * easeOutBack(progress));
    } else {
      anim.mesh.position.y = anim.fromY + (anim.toY - anim.fromY) * easeOutBounce(progress);
    }

    if (progress >= 1) {
      if (anim.kind === 'spawn') {
        anim.mesh.scale.setScalar(1);
      } else {
        anim.mesh.position.y = anim.toY;
        anim.record.y = anim.toY; // фиксируем итоговую высоту в записи
      }
      animations.delete(id);
    }
  }
}