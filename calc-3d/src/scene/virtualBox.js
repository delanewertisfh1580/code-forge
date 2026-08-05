// =============================================================================
// scene/virtualBox.js — виртуальный бокс: полупрозрачные стенки, рёбра
// и акцентная подложка на полу. Размер плавно меняется к целевому.
// =============================================================================

import * as THREE from 'three';
import { MAX_BOX, SCENE } from '../config.js';

export function createVirtualBox(scene) {
  // Текущий и целевой размер (w — X, h — Y, d — Z)
  const cur = { ...MAX_BOX }; // стартовый размер 3×3×3
  const target = { ...MAX_BOX };

  // Импульс подсветки при смене рекомендации
  let pulseValue = 0;

  // --- Группа из единичных геометрий, масштабируется под cur ---
  const group = new THREE.Group();

  // Стенки: единичный куб
  const wallMat = new THREE.MeshBasicMaterial({
    color: SCENE.accent,
    transparent: true,
    opacity: 0.045,
    side: THREE.DoubleSide,
    depthWrite: false // предметы внутри остаются видимыми
  });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat);
  group.add(walls);

  // Рёбра куба
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x3d8bff,
    transparent: true,
    opacity: 0.6
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    edgeMat
  );
  group.add(edges);

  // Низ бокса всегда стоит на полу
  group.position.y = cur.h / 2;
  scene.add(group);

  // --- Акцентная подложка на полу ---
  const padMat = new THREE.MeshBasicMaterial({
    color: SCENE.accent,
    transparent: true,
    opacity: 0.10,
    depthWrite: false
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.002; // чуть выше пола, без z-fighting
  scene.add(pad);

  // --- API ---

  // Задать целевые габариты — бокс плавно подъедет к ним
  function setTarget(w, h, d) {
    target.w = w;
    target.h = h;
    target.d = d;
  }

  // Подсветить смену рекомендации
  function pulse() {
    pulseValue = 1;
  }

  function getCur() { return cur; }
  function getTarget() { return target; }

  // Покадровое обновление: экспоненциальное приближение + затухание импульса
  function update(dt) {
    // Коэффициент сглаживания: k = 1 − exp(−dt·5)
    const k = 1 - Math.exp(-dt * 5);
    cur.w += (target.w - cur.w) * k;
    cur.h += (target.h - cur.h) * k;
    cur.d += (target.d - cur.d) * k;

    // Масштабируем группу; низ оставляем на полу
    group.scale.set(cur.w, cur.h, cur.d);
    group.position.y = cur.h / 2;

    // Подложка следует за габаритами бокса (локальная Y плоскости уходит в Z)
    pad.scale.set(cur.w, cur.d, 1);

    // Затухание импульса → прозрачность рёбер и подложки
    pulseValue = Math.max(0, pulseValue - dt * 1.6);
    edgeMat.opacity = 0.6 + pulseValue * 0.4;
    padMat.opacity = 0.10 + pulseValue * 0.12;
  }

  return { setTarget, update, pulse, getCur, getTarget };
}