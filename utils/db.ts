import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('lifebook.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS draft_entries (
      id TEXT PRIMARY KEY NOT NULL,
      question_id TEXT,
      body TEXT NOT NULL,
      photo_keys TEXT NOT NULL DEFAULT '[]',
      written_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_draft_sync_state ON draft_entries(sync_state);
  `);
  dbInstance = db;
  return db;
}

export type DraftEntry = {
  id: string;
  question_id: string | null;
  body: string;
  photo_keys: string[];
  written_at: string;
  created_at: string;
  sync_state: 'pending' | 'syncing' | 'synced' | 'failed';
};

export async function saveDraft(draft: Omit<DraftEntry, 'created_at' | 'sync_state'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO draft_entries (id, question_id, body, photo_keys, written_at, created_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    draft.id,
    draft.question_id,
    draft.body,
    JSON.stringify(draft.photo_keys),
    draft.written_at,
    new Date().toISOString(),
  );
}

export async function listPendingDrafts(): Promise<DraftEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    question_id: string | null;
    body: string;
    photo_keys: string;
    written_at: string;
    created_at: string;
    sync_state: DraftEntry['sync_state'];
  }>(`SELECT * FROM draft_entries WHERE sync_state IN ('pending', 'failed') ORDER BY created_at ASC`);
  return rows.map((r) => ({ ...r, photo_keys: JSON.parse(r.photo_keys) }));
}

export async function markDraftSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE draft_entries SET sync_state = 'synced' WHERE id = ?`, id);
}

export async function markDraftFailed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE draft_entries SET sync_state = 'failed' WHERE id = ?`, id);
}
