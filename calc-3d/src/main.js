// =============================================================================
// main.js — точка сборки приложения.
// Направление зависимостей: config ← domain ← (items, scene, controls, ui) ← main.
// =============================================================================

import * as THREE from 'three';
import { MAX_BOX } from './config.js';
import { getItems, getTotalVolume, subscribe } from './domain/state.js';
import { computeRecommendation } from './domain/pricing.js';
import { initScene } from './scene/renderer.js';
import { createVirtualBox } from './scene/virtualBox.js';
import { createManager } from './items/manager.js';
import * as animation from './items/animation.js';
import { initControls } from './controls/drag.js';
import { initDashboard } from './ui/dashboard.js';
import { initLibrary } from './ui/library.js';

// --- Сцена и виртуальный бокс (стартовый размер 3×3×3) ---
const canvas = document.getElementById('scene');
const { renderer, scene, camera, orbit } = initScene(canvas);

const virtualBox = createVirtualBox(scene);

// --- Дашборд (кэширует DOM один раз) ---
const dashboard = initDashboard();

// --- Менеджер предметов ---
// Примечание: scene передана в deps — менеджер добавляет/удаляет меши в сцене
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
    lastRecId = rec.type; // 'empty' | 'xl'
  }

  // Дашборд обновляется только здесь — НЕ в render-цикле
  dashboard.update(items, totalVolume, rec);
}

let lastRecId = 'empty'; // id последней рекомендации — для pulse()

const manager = createManager({ scene, virtualBox, animation, onChanged: recompute });

// --- Управление: перетаскивание, hover, двойной клик ---
initControls({ camera, domElement: canvas, orbit, manager });

// --- Библиотека вещей ---
initLibrary({ onAdd: manager.addItem, onClear: manager.clear });

// Единственная «реактивность»: подписка на изменение состава в state.
// Событийной шины нет — только этот subscribe и инъекция зависимостей.
subscribe(recompute);

// --- Render-цикл ---
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  // dt clamp ≤ 0.05: после возврата на вкладку Clock может дать большой скачок
  const dt = Math.min(clock.getDelta(), 0.05);
  virtualBox.update(dt);
  animation.update(dt);
  orbit.update(); // демпфирование
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    dashboard.hideLoader(); // лоадер скрываем после первого кадра
  }
}
tick();