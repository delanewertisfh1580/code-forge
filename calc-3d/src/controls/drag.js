// =============================================================================
// controls/drag.js — перетаскивание предметов (мышь и палец) и удаление
// по двойному клику.
// DragControls получает ЖИВУЮ ссылку на массив мешей менеджера, поэтому
// новые предметы подхватываются без пересоздания контролов.
// =============================================================================

import * as THREE from 'three';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { setEmissive } from '../items/factory.js';

export function initControls({ camera, domElement, orbit, manager }) {
  let hoveredId = null;  // предмет под курсором
  let draggingId = null; // предмет в перетаскивании

  const controls = new DragControls(manager.getMeshes(), camera, domElement);

  // --- Начало перетаскивания ---
  controls.addEventListener('dragstart', (event) => {
    draggingId = event.object.userData.id;
    orbit.enabled = false; // пока тащим предмет — камера не вращается
    manager.startDrag(draggingId);
    setEmissive(event.object, 0.5); // подсветка при перетаскивании сильнее
    document.body.classList.add('dragging');
  });

  // --- Движение ---
  controls.addEventListener('drag', (event) => {
    // DragControls сам подвинул меш по плоскости камеры; менеджер
    // ПЕРЕЗАПИШЕТ позицию после обрезки по стенам, всплывания на опору
    // или отката к последней валидной точке — дельты здесь не складываем
    manager.dragItem(
      event.object.userData.id,
      event.object.position.x,
      event.object.position.z
    );
  });

  // --- Конец перетаскивания ---
  controls.addEventListener('dragend', (event) => {
    const id = event.object.userData.id;
    draggingId = null;
    orbit.enabled = true; // возвращаем вращение камеры
    manager.endDrag(id);
    // Подсветка по состоянию hover: если курсор остался на предмете — 0.35
    setEmissive(event.object, hoveredId === id ? 0.35 : 0);
    document.body.classList.remove('dragging');
  });

  // --- Наведение курсора ---
  controls.addEventListener('hoveron', (event) => {
    hoveredId = event.object.userData.id;
    if (!draggingId) {
      setEmissive(event.object, 0.35);
      domElement.style.cursor = 'grab';
    }
  });

  controls.addEventListener('hoveroff', (event) => {
    if (hoveredId === event.object.userData.id) hoveredId = null;
    if (!draggingId) {
      setEmissive(event.object, 0);
      domElement.style.cursor = 'default';
    }
  });

  // --- Удаление по двойному клику (работает и двойным тапом) ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function onDoubleClick(event) {
    // Координаты луча из события — мышь или touch
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(manager.getMeshes(), false);
    if (hits.length > 0) {
      manager.removeItem(hits[0].object.userData.id);
    }
  }
  domElement.addEventListener('dblclick', onDoubleClick);

  return controls;
}