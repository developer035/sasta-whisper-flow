import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

export type TranscriptionRecord = {
	id: number;
	filename: string;
	text: string;
	language: string;
	confidence: number;
	created_at: string;
};

let db: Database.Database | null = null;
let dbInitialized = false;

export async function initializeDatabase(): Promise<void> {
	if (dbInitialized) {
		return;
	}

	// Use userData path for cross-platform compatibility
	const dbPath = path.join(app.getPath('userData'), 'transcriptions.sqlite');
	
	db = new Database(dbPath);

	// Create table if it doesn't exist
	db.exec(`
		CREATE TABLE IF NOT EXISTS transcriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			filename TEXT NOT NULL,
			text TEXT NOT NULL,
			language TEXT NOT NULL,
			confidence REAL NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`);

	dbInitialized = true;
	console.log('[database] Initialized at:', dbPath);
}

function ensureDb() {
	if (!db || !dbInitialized) {
		throw new Error('Database not initialized. Call initializeDatabase() first.');
	}
	return db;
}

export function saveTranscription(filename: string, text: string, language: string, confidence: number): TranscriptionRecord {
	const database = ensureDb();
	
	const stmt = database.prepare(
		'INSERT INTO transcriptions (filename, text, language, confidence) VALUES (?, ?, ?, ?)'
	);
	
	const result = stmt.run(filename, text, language, confidence);
	
	return {
		id: result.lastInsertRowid as number,
		filename,
		text,
		language,
		confidence,
		created_at: new Date().toISOString()
	};
}

export function getAllTranscriptions(limit = 100, offset = 0): TranscriptionRecord[] {
	const database = ensureDb();
	
	const stmt = database.prepare(
		'SELECT id, filename, text, language, confidence, created_at FROM transcriptions ORDER BY created_at DESC LIMIT ? OFFSET ?'
	);
	
	return stmt.all(limit, offset) as TranscriptionRecord[];
}

export function deleteTranscription(id: number): boolean {
	const database = ensureDb();
	
	const stmt = database.prepare('DELETE FROM transcriptions WHERE id = ?');
	stmt.run(id);
	
	return true;
}

export function clearAllTranscriptions(): boolean {
	const database = ensureDb();
	
	database.exec('DELETE FROM transcriptions');
	
	return true;
}

export function getTranscriptionCount(): number {
	const database = ensureDb();
	
	const stmt = database.prepare('SELECT COUNT(*) as count FROM transcriptions');
	const result = stmt.get() as { count: number };
	
	return result.count;
}

export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
		dbInitialized = false;
	}
}