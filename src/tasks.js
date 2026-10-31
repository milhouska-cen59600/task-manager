export const STORAGE_KEY = 'ukolnik.tasks.v1';
export const STATUSES = { todo: 'K vyřízení', 'in-progress': 'Rozpracované', done: 'Dokončené' };
export const PRIORITIES = { low: 'Nízká', medium: 'Střední', high: 'Vysoká' };
const priorityRank = { high: 0, medium: 1, low: 2 };

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validateFields(fields) {
  if (typeof fields?.title !== 'string' || !fields.title.trim() || fields.title.trim().length > 120) {
    throw new Error('Vyplňte název úkolu (nejvýše 120 znaků).');
  }
  if (typeof fields.description !== 'string' || fields.description.length > 2000) {
    throw new Error('Popis může mít nejvýše 2 000 znaků.');
  }
  if (!Object.hasOwn(STATUSES, fields.status) || !Object.hasOwn(PRIORITIES, fields.priority)) {
    throw new Error('Vyberte platný stav a prioritu.');
  }
  const dueDate = fields.dueDate;
  if (typeof dueDate !== 'string' || (dueDate && (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    || dueDate.startsWith('0000')
    || !Number.isFinite(Date.parse(`${dueDate}T00:00:00Z`))
    || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate
  ))) {
    throw new Error('Zadejte platné datum dokončení.');
  }
  return { title: fields.title.trim(), description: fields.description.trim(), status: fields.status, priority: fields.priority, dueDate };
}

export function createTask(fields, id = crypto.randomUUID(), now = new Date().toISOString()) {
  return { ...validateFields(fields), id, createdAt: now, updatedAt: now };
}

export function updateTask(task, fields, now = new Date().toISOString()) {
  return { ...task, ...validateFields(fields), updatedAt: now };
}

export function isOverdue(task, today = todayKey()) {
  return task.status !== 'done' && Boolean(task.dueDate) && task.dueDate < today;
}

export function selectTasks(tasks, { view = 'all', search = '', status = 'all', priority = 'all', sort = 'newest', today = todayKey() } = {}) {
  const query = search.trim().toLocaleLowerCase('cs');
  return tasks.filter(task => {
    if (view === 'today' && (task.dueDate !== today || task.status === 'done')) return false;
    if (view === 'overdue' && !isOverdue(task, today)) return false;
    if (view === 'done' && task.status !== 'done') return false;
    if (status !== 'all' && task.status !== status) return false;
    if (priority !== 'all' && task.priority !== priority) return false;
    return `${task.title} ${task.description}`.toLocaleLowerCase('cs').includes(query);
  }).sort((a, b) => {
    if (sort === 'due') {
      const dueOrder = (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
      if (dueOrder) return dueOrder;
    }
    if (sort === 'priority') {
      const order = priorityRank[a.priority] - priorityRank[b.priority];
      if (order) return order;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function serializeTasks(tasks) {
  return JSON.stringify({ version: 1, tasks }, null, 2);
}

export function parseTasks(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Data nejsou platný JSON. Použijte zálohu exportovanou z Úkolníku.');
  }
  if (data?.version !== 1 || !Array.isArray(data.tasks)) {
    throw new Error('Nepodporovaný formát zálohy. Očekávána je verze 1 a seznam úkolů.');
  }
  const ids = new Set();
  return data.tasks.map(task => {
    const fields = validateFields(task);
    if (typeof task.id !== 'string' || !task.id || ids.has(task.id)
      || typeof task.createdAt !== 'string' || !Number.isFinite(Date.parse(task.createdAt))
      || typeof task.updatedAt !== 'string' || !Number.isFinite(Date.parse(task.updatedAt))) {
      throw new Error('Záloha obsahuje neplatné nebo duplicitní úkoly.');
    }
    ids.add(task.id);
    return { ...fields, id: task.id, createdAt: new Date(task.createdAt).toISOString(), updatedAt: new Date(task.updatedAt).toISOString() };
  });
}

export function loadTasks(storage) {
  const json = storage.getItem(STORAGE_KEY);
  return json === null ? [] : parseTasks(json);
}

export function saveTasks(storage, tasks) {
  storage.setItem(STORAGE_KEY, serializeTasks(tasks));
}
