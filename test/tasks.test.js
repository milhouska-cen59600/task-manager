import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, createTask, updateTask, todayKey, isOverdue, selectTasks, serializeTasks, parseTasks, loadTasks, saveTasks } from '../src/tasks.js';

const fields = { title: 'Připravit nabídku', description: 'Pro nového klienta', status: 'todo', priority: 'medium', dueDate: '2026-10-31' };
const task = createTask(fields, 'task-1', '2026-10-20T08:00:00.000Z');

test('creates and updates tasks without changing identity or creation time', () => {
  assert.equal(createTask({ ...fields, title: '  Nabídka  ' }).title, 'Nabídka');
  const updated = updateTask(task, { ...fields, status: 'done' }, '2026-10-31T08:00:00.000Z');
  assert.equal(updated.id, task.id);
  assert.equal(updated.createdAt, task.createdAt);
  assert.equal(updated.status, 'done');
  assert.notEqual(updated.updatedAt, task.updatedAt);
  assert.equal(task.status, 'todo');
});

test('rejects invalid fields and dates', () => {
  for (const invalid of [
    { title: '  ' }, { title: 'x'.repeat(121) }, { description: 'x'.repeat(2001) },
    { status: '__proto__' }, { priority: 'urgent' }, { dueDate: '2026-02-30' },
    { dueDate: '2026-13-01' }, { dueDate: '31.10.2026' }, { dueDate: '0000-01-01' }, { dueDate: null },
  ]) assert.throws(() => createTask({ ...fields, ...invalid }));
  assert.doesNotThrow(() => createTask({ ...fields, dueDate: '' }));
  assert.doesNotThrow(() => createTask({ ...fields, dueDate: '2028-02-29' }));
  assert.doesNotThrow(() => createTask({ ...fields, dueDate: '0001-01-01' }));
});

test('uses local calendar dates and excludes completed and undated tasks from overdue', () => {
  assert.equal(todayKey(new Date(2026, 9, 31, 23, 59)), '2026-10-31');
  assert.equal(isOverdue(task, '2026-10-31'), false);
  assert.equal(isOverdue(task, '2026-11-01'), true);
  assert.equal(isOverdue({ ...task, status: 'done' }, '2026-11-01'), false);
  assert.equal(isOverdue({ ...task, dueDate: '' }, '2026-11-01'), false);
});

test('combines search, view, state and priority filters', () => {
  const progress = { ...task, id: 'task-2', status: 'in-progress', priority: 'high' };
  const done = { ...task, id: 'task-3', status: 'done' };
  const tasks = [task, progress, done];
  assert.equal(selectTasks(tasks, { search: '  KLIENTA ', status: 'in-progress', priority: 'high' }).length, 1);
  assert.equal(selectTasks(tasks, { view: 'today', today: '2026-10-31' }).length, 2);
  assert.equal(selectTasks(tasks, { view: 'overdue', today: '2026-11-01' }).length, 2);
  assert.deepEqual(selectTasks(tasks, { view: 'done' }), [done]);
  assert.equal(selectTasks(tasks, { search: 'neexistující' }).length, 0);
});

test('sorts dates with missing dates last and sorts priorities without mutating source', () => {
  const high = { ...task, id: 'high', priority: 'high', dueDate: '2026-10-30' };
  const undated = { ...task, id: 'undated', dueDate: '', createdAt: '2026-10-21T08:00:00.000Z' };
  const tasks = [task, undated, high];
  assert.deepEqual(selectTasks(tasks, { sort: 'due' }).map(item => item.id), ['high', 'task-1', 'undated']);
  assert.equal(selectTasks(tasks, { sort: 'priority' })[0].id, 'high');
  assert.equal(selectTasks(tasks)[0].id, 'undated');
  assert.deepEqual(tasks.map(item => item.id), ['task-1', 'undated', 'high']);
});

test('round trips versioned backups and rejects malformed or duplicate data', () => {
  assert.deepEqual(parseTasks(serializeTasks([task])), [task]);
  assert.deepEqual(parseTasks(serializeTasks([])), []);
  for (const data of ['not json', 'null', '{"version":2,"tasks":[]}', '{"version":1,"tasks":{}}']) assert.throws(() => parseTasks(data));
  assert.throws(() => parseTasks(serializeTasks([task, task])));
  assert.throws(() => parseTasks(serializeTasks([{ ...task, createdAt: 'invalid' }])));
  assert.throws(() => parseTasks(serializeTasks([{ ...task, id: 1 }])));
  assert.throws(() => parseTasks(serializeTasks([{ ...task, title: '' }])));
});

test('persists to storage and surfaces read, write and corrupt-data errors', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(loadTasks(storage), []);
  saveTasks(storage, [task]);
  assert.ok(data.has(STORAGE_KEY));
  assert.deepEqual(loadTasks(storage), [task]);
  data.set(STORAGE_KEY, 'broken');
  assert.throws(() => loadTasks(storage));
  assert.equal(data.get(STORAGE_KEY), 'broken');
  assert.throws(() => loadTasks({ getItem: () => { throw new Error('Blocked'); } }));
  assert.throws(() => saveTasks({ setItem: () => { throw new Error('Quota exceeded'); } }, [task]));
});
