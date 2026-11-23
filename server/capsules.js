import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const textFields = {
  project_name: { label: 'Project name', max: 120, required: true },
  prompt_title: { label: 'Prompt title', max: 160, required: true },
  prompt_version: { label: 'Prompt version', max: 32 },
  prompt_text: { label: 'Prompt text', max: 12000, required: true },
  response_summary: { label: 'Response summary', max: 4000 },
  category: { label: 'Category', max: 60 },
  usefulness: { label: 'Usefulness', max: 60 },
  screenshot_url: { label: 'Screenshot link', max: 2048 },
  notes: { label: 'Notes', max: 4000 },
};
const booleanFields = ['reviewed', 'improved'];
const fields = [...Object.keys(textFields), ...booleanFields];
const columns = ['id', ...fields, 'created_at'].join(', ');

export function openCapsules(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS capsules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      prompt_title TEXT NOT NULL,
      prompt_version TEXT NOT NULL DEFAULT '',
      prompt_text TEXT NOT NULL,
      response_summary TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      usefulness TEXT NOT NULL DEFAULT '',
      reviewed INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0, 1)),
      improved INTEGER NOT NULL DEFAULT 0 CHECK (improved IN (0, 1)),
      screenshot_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS capsules_owner ON capsules (user_id, id DESC);
  `);

  return {
    db,
    statements: {
      list: db.prepare(`SELECT ${columns} FROM capsules WHERE user_id = :user_id ORDER BY id DESC`),
      create: db.prepare(`INSERT INTO capsules (user_id, ${fields.join(', ')})
        VALUES (:user_id, ${fields.map(field => `:${field}`).join(', ')}) RETURNING ${columns}`),
      update: db.prepare(`UPDATE capsules SET ${fields.map(field => `${field} = :${field}`).join(', ')}
        WHERE id = :id AND user_id = :user_id RETURNING ${columns}`),
      remove: db.prepare('DELETE FROM capsules WHERE id = :id AND user_id = :user_id'),
    },
  };
}

export function validateCapsule(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send a JSON object.' };
  const values = {};

  for (const [field, { label, max, required }] of Object.entries(textFields)) {
    const input = body[field] ?? '';
    if (typeof input !== 'string') return { error: `${label} must be text.` };
    const value = input.trim();
    if (!value && required) return { error: `${label} is required.` };
    if (value.length > max) return { error: `${label} must be ${max} characters or fewer.` };
    values[field] = value;
  }

  for (const field of booleanFields) {
    const value = body[field] ?? false;
    if (![true, false, 0, 1].includes(value)) return { error: `${field} must be true or false.` };
    values[field] = Number(value);
  }

  if (values.screenshot_url) {
    const url = URL.parse(values.screenshot_url);
    if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      return { error: 'Screenshot link must be a valid HTTP or HTTPS URL without credentials.' };
    }
    values.screenshot_url = url.href;
  }

  return { values };
}

export function readCapsule(row) {
  return { ...row, reviewed: Boolean(row.reviewed), improved: Boolean(row.improved) };
}
