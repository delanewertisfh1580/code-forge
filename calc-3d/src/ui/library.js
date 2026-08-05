// =============================================================================
// ui/library.js — библиотека вещей.
// Кнопки генерируются динамически из ITEM_TYPES (единый источник правды).
// Модуль не импортирует three — только DOM и config.
// =============================================================================

import { ITEM_TYPES } from '../config.js';

// Объём с десятичной запятой: 0.125 → «0,125»
function formatVolume(value) {
  return parseFloat(value.toFixed(3)).toString().replace('.', ',');
}

export function initLibrary({ onAdd, onClear }) {
  const container = document.getElementById('library-items');

  // Кнопки предметов — строго из config, ничего не хардкодим
  for (const [type, cfg] of Object.entries(ITEM_TYPES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-btn';
    btn.innerHTML = `
      <span class="item-ico" style="--c: #${cfg.color.toString(16).padStart(6, '0')}">${cfg.emoji}</span>
      <span class="item-meta">
        <b>${cfg.label}</b>
        <small>${cfg.dimsLabel} · ${formatVolume(cfg.volume)} м³</small>
      </span>
      <span class="item-add">+</span>
    `;
    btn.addEventListener('click', () => onAdd(type));
    container.appendChild(btn);
  }

  // Кнопка очистки сцены
  document.getElementById('btn-clear').addEventListener('click', onClear);
}