// =============================================================================
// ui/dashboard.js — дашборд расчёта: метрики, рекомендация, цена, warning.
// Обновляется ТОЛЬКО по изменению состава — не в render-цикле.
// Модуль не импортирует three.
// =============================================================================

// Число с десятичной запятой; лишние нули в дробной части отбрасываются
function formatNumber(value, digits = 2) {
  return parseFloat(value.toFixed(digits)).toString().replace('.', ',');
}

export function initDashboard() {
  // Кэш DOM-элементов (id из index.html)
  const el = {
    count: document.getElementById('m-count'),
    vol: document.getElementById('m-vol'),
    cap: document.getElementById('m-cap'),
    fill: document.getElementById('m-fill'),
    fillBar: document.getElementById('m-fill-bar'),
    rec: document.getElementById('m-rec'),
    recName: document.getElementById('m-rec-name'),
    recDims: document.getElementById('m-rec-dims'),
    price: document.getElementById('m-price'),
    warning: document.getElementById('warning'),
    hint: document.getElementById('hint'),
    loader: document.getElementById('loader')
  };

  const priceFmt = new Intl.NumberFormat('ru-RU'); // «7 000» — пробел в тысячах
  let lastBadge = null; // текст бейджа — для анимации смены
  let hintDimmed = false;

  // --- Мобильное раскрытие дашборда по тапу ---
  // На ≤860px дашборд свёрнут в плашку с цифрами; тап раскрывает и сворачивает.
  // Клики по кнопкам и ссылкам внутри не перехватываем.
  const root = document.querySelector('.dashboard');
  root.addEventListener('click', (event) => {
    if (!window.matchMedia('(max-width: 860px)').matches) return;
    if (event.target.closest('button, a')) return;
    root.classList.toggle('open');
  });

  // Смена бейджа с анимацией .pop (перезапуск через reflow)
  function setBadge(text, dataS) {
    if (lastBadge === text) return;
    lastBadge = text;
    el.rec.textContent = text;
    if (dataS) el.rec.setAttribute('data-s', dataS);
    else el.rec.removeAttribute('data-s');
    el.rec.classList.remove('pop');
    void el.rec.offsetWidth; // reflow — иначе анимация не перезапустится
    el.rec.classList.add('pop');
  }

  // Основной апдейт: вызывается только при изменении состава
  function update(items, totalVolume, rec) {
    el.count.textContent = items.length;
    el.vol.textContent = formatNumber(totalVolume, 2);

    if (rec.type === 'empty') {
      // Пустая сцена: всё в нулях, бокс L 3×3×3 остаётся визуальным фоном
      el.cap.textContent = '';
      el.fill.textContent = '0%';
      el.fillBar.style.width = '0%';
      el.fillBar.classList.remove('hot');
      setBadge('—', null);
      el.recName.textContent = 'Добавьте вещи';
      el.recDims.textContent = 'Нажмите на предмет из библиотеки';
      el.price.textContent = '0 ₽';
      el.warning.classList.remove('show');
      return;
    }

    if (rec.type === 'box') {
      const box = rec.box;
      el.cap.textContent = ` · из ${formatNumber(box.volume, 1)} м³`;
      // Заполненность — от объёма РЕКОМЕНДОВАННОГО бокса
      const pct = Math.min(100, Math.round((totalVolume / box.volume) * 100));
      el.fill.textContent = `${pct}%`;
      el.fillBar.style.width = `${pct}%`;
      el.fillBar.classList.toggle('hot', pct > 85); // оранжевая при >85%
      setBadge(box.id, box.id);
      el.recName.textContent = `Бокс ${box.id}`;
      el.recDims.textContent =
        `${formatNumber(box.w)} × ${formatNumber(box.d)} × ${formatNumber(box.h)} м` +
        ` · до ${formatNumber(box.volume, 1)} м³`;
      el.price.textContent = `${priceFmt.format(box.price)} ₽/мес`;
      el.warning.classList.remove('show');
      return;
    }

    // rec.type === 'xl': объём больше 27 м³
    el.cap.textContent = ' · из 27 м³';
    el.fill.textContent = '100%';
    el.fillBar.style.width = '100%';
    el.fillBar.classList.add('hot');
    setBadge('XL', 'XL');
    el.recName.textContent = 'Нестандартный бокс';
    el.recDims.textContent = 'Объём больше 27 м³';
    el.price.textContent = 'По запросу';
    el.warning.classList.add('show');
  }

  // Скрыть лоадер (после первого кадра) и запланировать затухание подсказки
  function hideLoader() {
    el.loader.classList.add('hide');
    if (!hintDimmed) {
      hintDimmed = true;
      setTimeout(() => el.hint.classList.add('dim'), 9000);
    }
  }

  return { update, hideLoader };
}