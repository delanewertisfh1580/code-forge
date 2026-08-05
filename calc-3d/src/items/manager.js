// =============================================================================
// items/manager.js — менеджер предметов сцены.
// Связывает domain/state и 3D-слой: владеет живым массивом мешей
// (DragControls получает его по ссылке) и синхронизирует его с state.
//
// ВАЖНО: высота предметов никогда не задаётся «вручную» — только через
// computeSupportY и анимации. Жёсткого y = 0 здесь нет и быть не может.
// =============================================================================

import { ANIM, ITEM_TYPES } from '../config.js';
import {
  addItem as stateAdd,
  removeItem as stateRemove,
  clear as stateClear,
  getItems,
  getItem
} from '../domain/state.js';
import {
  computeSupportY,
  clampToBounds,
  findFallen,
  findSpawnSpot
} from '../domain/stacking.js';
import { createItemMesh, disposeMesh } from './factory.js';

const EPS = ANIM.EPS;

export function createManager(deps) {
  const { scene, virtualBox, animation, onChanged } = deps;

  const meshes = [];          // Живой массив: push/splice на месте ради DragControls
  const dragging = new Map(); // id → последняя валидная позиция {x, y, z}

  // --- Вспомогательные ---

  function getMeshById(id) {
    return meshes.find(mesh => mesh.userData.id === id) || null;
  }

  // Settle-проход: роняет предметы, потерявшие опору
  function settle() {
    for (const { id, toY } of findFallen(getItems())) {
      const mesh = getMeshById(id);
      const record = getItem(id);
      if (mesh && record) animation.startDrop(mesh, record, toY);
    }
  }

  // --- Добавление ---

  function addItem(type) {
    const cfg = ITEM_TYPES[type];

    // Сначала state: подписчик тут же пересчитает рекомендацию и целевой
    // размер виртуального бокса — спавн ищем уже в целевом боксе
    const record = stateAdd({
      type,
      x: 0, z: 0, y: 0,
      w: cfg.w, d: cfg.d, h: cfg.h,
      volume: cfg.volume,
      stackable: cfg.stackable,
      supportTop: cfg.supportTop,
      shelfLevels: cfg.shelfLevels
    });

    // Спавн внутри целевого бокса: без 2D-перекрытий + предикат валидной опоры
    const box = virtualBox.getTarget();
    const spot = findSpawnSpot(record, getItems(), box, (x, z) => {
      record.x = x;
      record.z = z;
      return !computeSupportY(record, getItems(), box.h).blocked;
    });
    record.x = spot.x;
    record.z = spot.z;
    record.y = computeSupportY(record, getItems(), box.h).y;

    const mesh = createItemMesh(type, record.id);
    mesh.position.set(record.x, record.y, record.z);
    scene.add(mesh);
    meshes.push(mesh);

    animation.startSpawn(mesh);
    onChanged();
  }

  // --- Перетаскивание ---

  function startDrag(id) {
    const mesh = getMeshById(id);
    const record = getItem(id);
    if (!mesh || !record) return;
    // Если предмет падал — перехват отменяет падение
    animation.cancel(id);
    record.y = mesh.position.y;
    dragging.set(id, { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
  }

  function dragItem(id, x, z) {
    const mesh = getMeshById(id);
    const record = getItem(id);
    if (!mesh || !record) return;

    // Обрезка по стенам текущего (анимируемого) бокса
    const box = virtualBox.getCur();
    const clamped = clampToBounds(x, z, record, box);
    record.x = clamped.x;
    record.z = clamped.z;

    const support = computeSupportY(record, getItems(), box.h);
    if (support.blocked) {
      // Откат к последней валидной позиции: ПЕРЕЗАПИСЫВАЕМ позицию меша,
      // а не складываем с дельтой (DragControls сам двигал меш)
      const last = dragging.get(id);
      if (last) {
        record.x = last.x; record.y = last.y; record.z = last.z;
        mesh.position.set(last.x, last.y, last.z);
      }
      return;
    }

    // Предмет «всплывает» на опору под ним — пересечения исключены
    record.y = support.y;
    mesh.position.set(clamped.x, support.y, clamped.z);
    dragging.set(id, { x: clamped.x, y: support.y, z: clamped.z });
  }

  function endDrag(id) {
    dragging.delete(id);
    const mesh = getMeshById(id);
    const record = getItem(id);
    if (!mesh || !record) return;

    // Пересчёт опоры после отпускания: если предмет выше опоры — падение
    const support = computeSupportY(record, getItems(), virtualBox.getCur().h);
    if (!support.blocked && mesh.position.y > support.y + EPS) {
      animation.startDrop(mesh, record, support.y);
    }

    // Роняем предметы, оставшиеся без опоры
    settle();
    onChanged();
  }

  // --- Удаление ---

  function removeItem(id) {
    const index = meshes.findIndex(mesh => mesh.userData.id === id);
    if (index === -1) return;
    const [mesh] = meshes.splice(index, 1);
    scene.remove(mesh);
    disposeMesh(mesh); // dispose геометрии и материала обязателен
    animation.cancel(id);
    dragging.delete(id);
    stateRemove(id);
    settle(); // роняем всё, что стояло на удалённом предмете
    onChanged();
  }

  function clear() {
    for (const mesh of meshes) {
      scene.remove(mesh);
      disposeMesh(mesh);
    }
    meshes.length = 0;
    dragging.clear();
    animation.cancelAll();
    stateClear();
    onChanged();
  }

  return {
    addItem,
    startDrag,
    dragItem,
    endDrag,
    removeItem,
    clear,
    getMeshes: () => meshes, // живая ссылка для DragControls
    getMeshById
  };
}