import fs from 'fs/promises';
import path from 'path';
import { PROJECT_ROOT } from './bootstrapEnv.js';
import { readJson } from './jsonl.js';

export const TASK_DIR = path.join(PROJECT_ROOT, 'evaluation/tasks');

export async function listTaskFiles(category = 'all') {
  const entries = await fs.readdir(TASK_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(TASK_DIR, entry.name))
    .sort();

  if (!category || category === 'all') return files;
  return files.filter((file) => path.basename(file, '.json') === category);
}

export async function loadTasks({ category = 'all', limit = 0 } = {}) {
  const files = await listTaskFiles(category);
  const groups = [];
  for (const file of files) {
    const tasks = await readJson(file);
    groups.push(...tasks.map((task) => ({
      ...task,
      task_file: path.relative(PROJECT_ROOT, file).replace(/\\/g, '/')
    })));
  }
  return limit > 0 ? groups.slice(0, limit) : groups;
}
