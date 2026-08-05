// =============================================================================
// domain/state.js — состояние приложения: состав предметов.
// Чистый модуль: без three и без DOM. Единственный механизм «реактивности» —
// подписка на изменение состава; событийная шина запрещена.
// =============================================================================

const items = [];       // Живой массив записей предметов (ItemRecord)
let totalVolume = 0;    // Суммарный объём всех вещей, м³
let nextId = 1;         // Счётчик уникальных идентификаторов
const listeners = [];   // Слушатели изменения состава

// Уведомить всех подписчиков об изменении состава
function notify() {
  for (const listener of listeners) listener();
}

// Добавить предмет. Присваивает id, обновляет объём, уведомляет подписчиков.
// Возвращает запись с присвоенным id — она нужна менеджеру для создания меша.
export function addItem(record) {
  record.id = nextId++;
  items.push(record);
  totalVolume += record.volume;
  notify();
  return record;
}

// Удалить предмет по id. Возвращает удалённую запись или null.
export function removeItem(id) {
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  const [removed] = items.splice(index, 1);
  totalVolume -= removed.volume;
  // Защита от накопления ошибки плавающей точки
  if (totalVolume < 0) totalVolume = 0;
  notify();
  return removed;
}

// Полная очистка сцены
export function clear() {
  items.length = 0;
  totalVolume = 0;
  notify();
}

// Живой массив предметов. Ссылку НЕ заменять — только менять на месте,
// чтобы DragControls всегда видел актуальный список мешей.
export function getItems() {
  return items;
}

// Получить предмет по id
export function getItem(id) {
  return items.find(item => item.id === id) || null;
}

// Количество предметов
export function getCount() {
  return items.length;
}

// Суммарный объём вещей, м³
export function getTotalVolume() {
  return totalVolume;
}

// Подписка на изменение состава (add/remove/clear).
// Возвращает функцию отписки.
export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}