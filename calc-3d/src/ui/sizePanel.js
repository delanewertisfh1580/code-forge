// =============================================================================
// ui/sizePanel.js — панель размеров выбранного предмета (v1.1) и настройка
// полок стеллажа (v1.1.1). DOM создаётся динамически — index.html не меняется.
// Модуль не импортирует three: только DOM, config и колбэки (валидацию
// и применение делает менеджер).
// =============================================================================

import { DIM_LIMITS, ITEM_TYPES, SHELF_LIMITS } from '../config.js';
import './sizepanel.css'; // стили панели инлайнятся в сборку вместе с JS

// Число с десятичной запятой для текстовых подписей
function formatNumber(value, digits = 3) {
  return parseFloat(value.toFixed(digits)).toString().replace('.', ',');
}

// Округление для value числовых инпутов (в input.value всегда точка)
function toInputValue(value) {
  return String(Math.round(value * 100) / 100);
}

export function createSizePanel({ onResize, onShelfLevels, getItem }) {
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
    <div class="size-shelf"></div>
    <div class="size-error"></div>
  `;
  document.body.appendChild(root);

  const title = root.querySelector('.size-panel-title');
  const closeBtn = root.querySelector('.size-panel-close');
  const volEl = root.querySelector('.size-vol');
  const errorEl = root.querySelector('.size-error');
  const shelfEl = root.querySelector('.size-shelf');
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
  let lastLevels = null; // последний применённый набор полок (для отката)

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

  // --- Секция полок стеллажа (v1.1.1) ---

  // Перерисовка списка полок: инпут высоты + удаление на каждую строку,
  // внизу — кнопка добавления. У единственной полки кнопки удаления нет.
  function renderShelfSection(levels, shelfH) {
    shelfEl.innerHTML = '';
    if (!Array.isArray(levels)) return;

    const head = document.createElement('div');
    head.className = 'size-shelf-head';
    head.textContent = `Полки: ${levels.length} из ${SHELF_LIMITS.MAX_LEVELS}`;
    shelfEl.appendChild(head);

    const list = document.createElement('div');
    list.className = 'size-shelf-list';

    levels.forEach((level, index) => {
      const row = document.createElement('div');
      row.className = 'size-shelf-row';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = SHELF_LIMITS.MIN_LEVEL;
      input.max = shelfH;
      input.step = DIM_LIMITS.STEP;
      input.inputMode = 'decimal';
      input.value = toInputValue(level);
      input.addEventListener('input', onShelfInput);

      const unit = document.createElement('span');
      unit.className = 'size-shelf-unit';
      unit.textContent = 'м';

      row.appendChild(input);
      row.appendChild(unit);

      if (levels.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'size-shelf-remove';
        remove.title = 'Удалить полку';
        remove.textContent = '✕';
        remove.addEventListener('click', () => {
          applyLevels(collectLevels().filter((_, i) => i !== index));
        });
        row.appendChild(remove);
      }
      list.appendChild(row);
    });
    shelfEl.appendChild(list);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'size-shelf-add';
    add.textContent = '+ Добавить полку';
    add.disabled = levels.length >= SHELF_LIMITS.MAX_LEVELS;
    add.addEventListener('click', () => {
      const current = collectLevels();
      const last = current.length > 0 ? Math.max(...current.filter(Number.isFinite)) : 0;
      const nextLevel = Math.min(shelfH, last + SHELF_LIMITS.ADD_STEP);
      applyLevels([...current, nextLevel]);
    });
    shelfEl.appendChild(add);
  }

  // Собрать значения полок из текущих инпутов секции
  function collectLevels() {
    return [...shelfEl.querySelectorAll('.size-shelf-row input')]
      .map(input => parseFloat(input.value));
  }

  function onShelfInput() {
    clearTimeout(timer);
    timer = setTimeout(() => applyLevels(collectLevels()), 250);
  }

  // Применить набор полок через менеджер; при отказе — откат полей
  function applyLevels(levels) {
    clearError();
    if (currentId === null) return;
    const ok = onShelfLevels(currentId, levels);
    const record = getItem(currentId);
    const levelsNow = record && Array.isArray(record.shelfLevels) ? [...record.shelfLevels] : lastLevels;
    const hNow = record ? record.h : 0;
    if (ok) {
      lastLevels = levelsNow;
      renderShelfSection(lastLevels, hNow);
    } else {
      showError('Полки: недопустимая конфигурация — пределы, зазор или вещи на полках.');
      renderShelfSection(lastLevels, hNow); // откат полей к последнему применённому
    }
  }

  // --- Применение габаритов ---

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
    if (!onResize(currentId, w, d, h)) {
      showError('Не помещается: уменьшите размер или разберите стек.');
      return;
    }
    updateVolume();
    // У стеллажа полки масштабируются вместе с высотой — перечитываем запись
    if (lastLevels !== null) {
      const record = getItem(currentId);
      if (record && Array.isArray(record.shelfLevels)) {
        lastLevels = [...record.shelfLevels];
        renderShelfSection(lastLevels, record.h);
      }
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
    inpW.value = toInputValue(record.w);
    inpD.value = toInputValue(record.d);
    inpH.value = toInputValue(record.h);
    clearError();
    updateVolume();
    // Стеллаж: показываем секцию полок; прочие предметы — скрываем
    if (Array.isArray(record.shelfLevels)) {
      lastLevels = [...record.shelfLevels];
      renderShelfSection(lastLevels, record.h);
    } else {
      lastLevels = null;
      shelfEl.innerHTML = '';
    }
    root.classList.add('show');
  }

  function close() {
    currentId = null;
    lastLevels = null;
    clearTimeout(timer);
    root.classList.remove('show');
  }

  return { open, close };
}