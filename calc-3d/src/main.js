// =============================================================================
// main.js — точка сборки приложения.
// Направление зависимостей: config ← domain ← (items, scene, controls, ui) ← main.
// v1.1: панель размеров предметов. v1.1.1: настройка полок стеллажа,
// исправлено пересечение предметов на полках (clearance-проверка в домене).
// =============================================================================

import * as THREE from 'three';
import { MAX_BOX } from './config.js';
import { getItems, getTotalVolume, getItem, subscribe } from './domain/state.js';
import { computeRecommendation } from './domain/pricing.js';
import { initScene } from './scene/renderer.js';
import { createVirtualBox } from './scene/virtualBox.js';
import { createManager } from './items/manager.js';
import * as animation from './items/animation.js';
import { initControls } from './controls/drag.js';
import { initDashboard } from './ui/dashboard.js';
import { initLibrary } from './ui/library.js';
import { createSizePanel } from './ui/sizePanel.js';

// --- Сцена и виртуальный бокс ---
const canvas = document.getElementById('scene');
const { renderer, scene, camera, orbit } = initScene(canvas);

const virtualBox = createVirtualBox(scene); // стартовый размер 3×3×3 (MAX_BOX)

// --- Дашборд ---
const dashboard = initDashboard();

// --- Менеджер предметов ---
// scene передаётся в deps — менеджер добавляет и удаляет меши
const manager = createManager({ scene, virtualBox, animation, onChanged: recompute });

// --- Панель размеров и полок (v1.1 / v1.1.1) ---
// Валидацию и применение делает менеджер; getItem нужен панели, чтобы
// перечитывать применённые значения после ресайза (полки масштабируются).
const sizePanel = createSizePanel({
  onResize: manager.resizeItem,
  onShelfLevels: manager.setShelfLevels,
  getItem
});

// --- Управление: перетаскивание, выбор кликом, удаление двойным кликом ---
initControls({
  camera,
  domElement: canvas,
  orbit,
  manager,
  onSelect: (id) => {
    // null — клик в пустоту или предмет удалён: панель закрываем
    if (id === null) {
      sizePanel.close();
      return;
    }
    const record = getItem(id);
    if (record) sizePanel.open(id, record);
  }
});

// --- Библиотека ---
initLibrary({
  onAdd: manager.addItem,
  onClear: () => {
    sizePanel.close(); // панель выбранного предмета закрываем вместе с очисткой
    manager.clear();
  }
});

// --- Пересчёт при любом изменении состава ---
let lastRecId = 'empty'; // id последней рекомендации для пульса

function recompute() {
  const items = getItems();
  const totalVolume = getTotalVolume();
  const rec = computeRecommendation(items, totalVolume);

  if (rec.type === 'box') {
    // Бокс плавно подъезжает к рекомендованному размеру
    virtualBox.setTarget(rec.box.w, rec.box.h, rec.box.d);
    if (lastRecId !== rec.box.id) virtualBox.pulse();
    lastRecId = rec.box.id;
  } else {
    // empty или xl: держим максимальный бокс 3×3×3
    virtualBox.setTarget(MAX_BOX.w, MAX_BOX.h, MAX_BOX.d);
    lastRecId = rec.type;
  }

  // Дашборд обновляется только здесь — не в render-цикле
  dashboard.update(items, totalVolume, rec);
}

// Единственная «реактивность»: подписка на изменение состава в state
subscribe(recompute);

// --- Render-цикл ---
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  // Clamp dt: после возвращения на вкладку clock может дать большое значение
  const dt = Math.min(clock.getDelta(), 0.05);
  virtualBox.update(dt);
  animation.update(dt);
  orbit.update(); // демпфирование
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    dashboard.hideLoader(); // лоадер убираем после первого кадра
  }
}
tick();