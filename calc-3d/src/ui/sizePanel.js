// =============================================================================
// ui/sizePanel.js — панель размеров выбранного предмета (v1.1).
// DOM создаётся динамически — index.html не меняется. Модуль не импортирует
// three: только DOM, config и колбэк (валидацию и применение делает менеджер).
// =============================================================================

import { DIM_LIMITS, ITEM_TYPES } from '../config.js';
import './sizepanel.css'; // стили панели инлайнятся в сборку вместе с JS

// Число с десятичной запятой для отображения
function formatNumber(value, digits = 3) {
  return parseFloat(value.toFixed(digits)).toString().replace('.', ',');
}

export function createSizePanel({ onResize }) {
  // --- DOM панели ---
  const root = document.createElement('div');
  root.className = 'size-panel panel';
  root.innerHTML = `
    <div class="size-panel-head">
      <b class="size-panel-title">Размер вещи</b>
      <button type="button" class="size-panel-close" title="Закрыть">✕</button>
    </div>
    <div class="size-inputs">
      <label class="size-field"><span>Ширина X</span></label>
      <label class="size-field"><span>Глубина Z</span></label>
      <label class="size-field"><span>Высота Y</span></label>
    </div>
    <div class="size-vol"></div>
    <div class="size-error"></div>
  `;
  document.body.appendChild(root);

  const title = root.querySelector('.size-panel-title');
  const closeBtn = root.querySelector('.size-panel-close');
  const volEl = root.querySelector('.size-vol');
  const errorEl = root.querySelector('.size-error');
  const fields = root.querySelectorAll('.size-field');

  // Инпуты добавляем внутрь label: клик по подписи тоже фокусирует поле
  const inputs = [...fields].map(field => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = DIM_LIMITS.MIN;
    input.max = DIM_LIMITS.MAX;
    input.step = DIM_LIMITS.STEP;
    input.inputMode = 'decimal';
    field.appendChild(input);
    return input;
  });
  const [inpW, inpD, inpH] = inputs;

  let currentId = null;
  let timer = null;

  // --- Отображение ---

  function updateVolume() {
    const w = parseFloat(inpW.value);
    const d = parseFloat(inpD.value);
    const h = parseFloat(inpH.value);
    const ok = [w, d, h].every(Number.isFinite);
    volEl.textContent = ok ? `Объём: ${formatNumber(w * d * h)} м³` : '';
  }

  function showError(text) {
    errorEl.textContent = text;
    errorEl.classList.add('show');
  }

  function clearError() {
    errorEl.classList.remove('show');
    inputs.forEach(input => input.classList.remove('invalid'));
  }

  // --- Применение изменений ---

  function apply() {
    clearError();
    if (currentId === null) return;

    const w = parseFloat(inpW.value);
    const d = parseFloat(inpD.value);
    const h = parseFloat(inpH.value);
    if (![w, d, h].every(Number.isFinite)) {
      showError('Введите три числа.');
      return;
    }
    if (w < DIM_LIMITS.MIN || d < DIM_LIMITS.MIN || h < DIM_LIMITS.MIN ||
        w > DIM_LIMITS.MAX || d > DIM_LIMITS.MAX || h > DIM_LIMITS.MAX) {
      inputs.forEach(input => input.classList.add('invalid'));
      showError(`Допустимо от ${formatNumber(DIM_LIMITS.MIN, 2)} до ${DIM_LIMITS.MAX} м.`);
      return;
    }

    // Менеджер валидирует сцену пробным reflow; false — всё откатилось
    const ok = onResize(currentId, w, d, h);
    if (ok) {
      updateVolume();
    } else {
      showError('Не помещается: уменьшите размер или разберите стек.');
    }
  }

  // Живое применение с лёгким дебаунсом — геометрия перестраивается на лету
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      updateVolume();
      clearTimeout(timer);
      timer = setTimeout(apply, 250);
    });
  });
  closeBtn.addEventListener('click', close);

  // --- Публичное API ---

  // Открыть панель для предмета: заголовок и поля из его текущих габаритов
  function open(id, record) {
    currentId = id;
    const cfg = ITEM_TYPES[record.type];
    title.textContent = `${cfg.emoji} ${cfg.label} — размер`;
    inpW.value = record.w;
    inpD.value = record.d;
    inpH.value = record.h;
    clearError();
    updateVolume();
    root.classList.add('show');
  }

  function close() {
    currentId = null;
    clearTimeout(timer);
    root.classList.remove('show');
  }

  return { open, close };
}