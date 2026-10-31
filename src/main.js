import './style.css';
import { STORAGE_KEY, STATUSES, PRIORITIES, createTask, updateTask, isOverdue, selectTasks, serializeTasks, parseTasks, loadTasks, saveTasks, todayKey } from './tasks.js';

const $ = selector => document.querySelector(selector);
const form = $('#task-form');
const dialog = $('#task-dialog');
const confirmDialog = $('#confirm-dialog');
const viewTitles = { all: 'Všechny úkoly', today: 'Na dnešek', overdue: 'Po termínu', done: 'Dokončené' };
let tasks = [];
let view = 'all';
let editingId = null;
let pendingConfirmation = null;
let notificationTimer;
let storageReady = true;
let renderedDay;

function notify(message, error = false) {
  clearTimeout(notificationTimer);
  const notification = $('#notification');
  notification.textContent = message;
  notification.classList.toggle('notification-error', error);
  notification.setAttribute('role', error ? 'alert' : 'status');
  notification.hidden = false;
  if (!error) notificationTimer = setTimeout(() => { notification.hidden = true; }, 4000);
}

function persist(nextTasks) {
  if (!storageReady) {
    notify('Ukládání není dostupné. Nejprve vyřešte chybu úložiště a obnovte stránku.', true);
    return false;
  }
  try {
    saveTasks(window.localStorage, nextTasks);
  } catch (error) {
    console.error('Task storage write failed:', error);
    notify('Úkoly se nepodařilo uložit. Zkontrolujte dostupnost a volné místo úložiště prohlížeče. Změna nebyla provedena.', true);
    return false;
  }
  tasks = nextTasks;
  render();
  return true;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openTask(task = null) {
  editingId = task?.id ?? null;
  form.reset();
  $('#form-error').hidden = true;
  $('#dialog-title').textContent = task ? 'Upravit úkol' : 'Nový úkol';
  if (task) {
    for (const field of ['title', 'description', 'status', 'priority', 'dueDate']) form.elements.namedItem(field).value = task[field];
  }
  dialog.showModal();
  form.elements.namedItem('title').focus();
}

function askConfirmation(title, description, label, action) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-accept').textContent = label;
  pendingConfirmation = action;
  confirmDialog.showModal();
}

function taskCard(task, today) {
  const card = element('article', `task-card${task.status === 'done' ? ' task-done' : ''}`);
  const badges = element('div', 'card-badges');
  badges.append(element('span', `badge priority-${task.priority}`, `${PRIORITIES[task.priority]} priorita`), element('span', `badge status-${task.status}`, STATUSES[task.status]));
  const heading = element('h3', '', task.title);
  const description = element('p', 'task-description', task.description || 'Bez popisu');
  const date = element('span', `task-date${isOverdue(task, today) ? ' overdue' : ''}`);
  if (task.dueDate) {
    const formatted = new Intl.DateTimeFormat('cs', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${task.dueDate}T12:00:00`));
    date.textContent = `${isOverdue(task, today) ? 'Po termínu · ' : 'Termín · '}${formatted}`;
  } else date.textContent = 'Bez termínu';
  const footer = element('div', 'card-footer');
  const actions = element('div', 'card-actions');
  const complete = element('button', `icon-button complete-button${task.status === 'done' ? ' completed' : ''}`, '✓');
  complete.title = task.status === 'done' ? 'Vrátit k vyřízení' : 'Dokončit úkol';
  complete.dataset.taskId = task.id;
  complete.setAttribute('aria-label', `${complete.title}: ${task.title}`);
  complete.addEventListener('click', () => {
    const next = updateTask(task, { ...task, status: task.status === 'done' ? 'todo' : 'done' });
    if (persist(tasks.map(item => item.id === task.id ? next : item))) notify(next.status === 'done' ? 'Úkol dokončen. Dobrá práce!' : 'Úkol vrácen k vyřízení.');
  });
  const edit = element('button', 'text-button', 'Upravit');
  edit.setAttribute('aria-label', `Upravit úkol: ${task.title}`);
  edit.addEventListener('click', () => openTask(task));
  const remove = element('button', 'icon-button delete-button', '×');
  remove.title = 'Smazat úkol';
  remove.setAttribute('aria-label', `Smazat úkol: ${task.title}`);
  remove.addEventListener('click', () => askConfirmation('Smazat úkol?', `Úkol „${task.title}“ bude trvale smazán. Tento krok nelze vrátit.`, 'Smazat úkol', () => {
    if (persist(tasks.filter(item => item.id !== task.id))) {
      notify('Úkol byl smazán.');
      $('#new-task').focus();
    }
  }));
  actions.append(complete, edit, remove);
  footer.append(date, actions);
  card.append(badges, heading, description, footer);
  return card;
}

function render() {
  const today = todayKey();
  renderedDay = today;
  $('#today-label').textContent = new Intl.DateTimeFormat('cs', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#stat-total').textContent = tasks.length;
  $('#nav-count').textContent = tasks.length;
  $('#stat-progress').textContent = tasks.filter(task => task.status === 'in-progress').length;
  $('#stat-done').textContent = tasks.filter(task => task.status === 'done').length;
  $('#stat-overdue').textContent = tasks.filter(task => isOverdue(task, today)).length;
  $('#page-title').textContent = viewTitles[view];
  const selected = selectTasks(tasks, { view, search: $('#search').value, status: $('#status-filter').value, priority: $('#priority-filter').value, sort: $('#sort').value, today });
  $('#result-count').textContent = selected.length;
  const focusedTaskId = document.activeElement?.dataset.taskId;
  $('#task-list').replaceChildren(...selected.map(task => taskCard(task, today)));
  if (focusedTaskId) {
    const replacement = [...document.querySelectorAll('.complete-button')].find(button => button.dataset.taskId === focusedTaskId);
    (replacement ?? $('#new-task')).focus();
  }
  $('#empty-state').hidden = selected.length !== 0;
  const firstTask = tasks.length === 0 && view === 'all' && !$('#search').value && $('#status-filter').value === 'all' && $('#priority-filter').value === 'all';
  $('#empty-title').textContent = firstTask ? 'Dobrý plán začíná prvním úkolem' : 'Tady je zatím klid';
  $('#empty-description').textContent = firstTask ? 'Přidejte, co potřebujete udělat. Termíny a priority vám pomohou udržet směr.' : 'Tomuto pohledu neodpovídá žádný úkol. Zkuste změnit filtry nebo vytvořte nový úkol.';
  $('#empty-add').hidden = !firstTask;
  $('#reset-filters').hidden = firstTask;
}

function changeView(nextView) {
  view = nextView;
  $('#status-filter').value = 'all';
  for (const button of document.querySelectorAll('[data-view]')) {
    button.classList.toggle('active', button.dataset.view === view);
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  render();
}

$('#new-task').addEventListener('click', () => openTask());
$('#empty-add').addEventListener('click', () => openTask());
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#cancel-task').addEventListener('click', () => dialog.close());
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(form));
    if (editingId && !tasks.some(task => task.id === editingId)) throw new Error('Tento úkol již neexistuje. Zavřete formulář a obnovte přehled.');
    const nextTasks = editingId
      ? tasks.map(task => task.id === editingId ? updateTask(task, fields) : task)
      : [...tasks, createTask(fields)];
    if (persist(nextTasks)) {
      dialog.close();
      notify(editingId ? 'Změny úkolu byly uloženy.' : 'Nový úkol byl vytvořen.');
    } else {
      $('#form-error').textContent = 'Změny se nepodařilo uložit. Zkontrolujte úložiště prohlížeče a zkuste to znovu.';
      $('#form-error').hidden = false;
    }
  } catch (error) {
    $('#form-error').textContent = error.message;
    $('#form-error').hidden = false;
  }
});
$('#confirm-cancel').addEventListener('click', () => confirmDialog.close());
$('#confirm-accept').addEventListener('click', () => {
  const action = pendingConfirmation;
  confirmDialog.close();
  action?.();
});
confirmDialog.addEventListener('close', () => { pendingConfirmation = null; });
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => changeView(button.dataset.view));
for (const selector of ['#search', '#status-filter', '#priority-filter', '#sort']) $(selector).addEventListener(selector === '#search' ? 'input' : 'change', render);
$('#reset-filters').addEventListener('click', () => {
  $('#search').value = '';
  $('#priority-filter').value = 'all';
  changeView('all');
});
$('#export-tasks').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([serializeTasks(tasks)], { type: 'application/json' }));
  const link = element('a');
  link.href = url;
  link.download = `ukolnik-${todayKey()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Záloha byla připravena ke stažení.');
});
$('#import-tasks').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Záloha může mít nejvýše 5 MB.');
    const imported = parseTasks(await file.text());
    askConfirmation('Nahradit úkoly ze zálohy?', `Záloha obsahuje ${imported.length} úkolů. Nahradí všech ${tasks.length} současných úkolů. Před pokračováním doporučujeme exportovat současná data.`, 'Nahradit úkoly', () => {
      if (persist(imported)) notify('Záloha byla úspěšně načtena.');
    });
  } catch (error) {
    console.error('Task import failed:', error);
    notify(`Import se nezdařil: ${error.message}`, true);
  }
});

window.addEventListener('storage', event => {
  if (event.storageArea === window.localStorage && (event.key === null || event.key === STORAGE_KEY)) {
    readStorage();
    render();
  }
});
function readStorage() {
  try {
    tasks = loadTasks(window.localStorage);
    storageReady = true;
    $('#storage-error').hidden = true;
  } catch (error) {
    console.error('Task storage read failed:', error);
    storageReady = false;
    $('#storage-error').textContent = `Úložiště nelze načíst: ${error.message} Původní data nebyla přepsána. Zkontrolujte nastavení prohlížeče nebo obnovte úložiště ze své zálohy, potom znovu načtěte stránku.`;
    $('#storage-error').hidden = false;
  }
  for (const selector of ['#new-task', '#empty-add', '#import-tasks', '#export-tasks']) $(selector).disabled = !storageReady;
}
readStorage();
render();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    readStorage();
    render();
  }
});
setInterval(() => {
  if (todayKey() !== renderedDay) render();
}, 60_000);
