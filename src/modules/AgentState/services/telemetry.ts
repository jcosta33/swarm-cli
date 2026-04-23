import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface SessionRecord {
    id: string;
    slug: string;
    agent: string;
    model: string | null;
    started_at: string;
    finished_at: string | null;
    exit_code: number | null;
}

interface EventRecord {
    session_id: string;
    timestamp: string;
    level: string;
    event_type: string;
    message: string;
    metadata: string | null;
}

function get_db_path(repoRoot: string): string {
    const logsDir = join(repoRoot, '.agents', 'logs');
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
    }
    return join(logsDir, 'telemetry.db');
}

function init_schema(db: Database.Database): void {
    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            slug TEXT NOT NULL,
            agent TEXT NOT NULL,
            model TEXT,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            exit_code INTEGER
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    `);
}

function get_db(repoRoot: string): Database.Database {
    const dbPath = get_db_path(repoRoot);
    const db = new Database(dbPath);
    init_schema(db);
    return db;
}

export function record_session(repoRoot: string, session: SessionRecord): void {
    const db = get_db(repoRoot);
    const stmt = db.prepare(`
        INSERT INTO sessions (id, slug, agent, model, started_at, finished_at, exit_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            finished_at = excluded.finished_at,
            exit_code = excluded.exit_code
    `);
    stmt.run(session.id, session.slug, session.agent, session.model, session.started_at, session.finished_at, session.exit_code);
    db.close();
}

export function record_event(repoRoot: string, event: EventRecord): void {
    const db = get_db(repoRoot);
    const stmt = db.prepare(`
        INSERT INTO events (session_id, timestamp, level, event_type, message, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(event.session_id, event.timestamp, event.level, event.event_type, event.message, event.metadata);
    db.close();
}

export function query_sessions(repoRoot: string, limit = 50): SessionRecord[] {
    const db = get_db(repoRoot);
    const stmt = db.prepare(`
        SELECT id, slug, agent, model, started_at, finished_at, exit_code
        FROM sessions
        ORDER BY started_at DESC
        LIMIT ?
    `);
    const rows = stmt.all(limit) as SessionRecord[];
    db.close();
    return rows;
}

export function query_events(repoRoot: string, sessionId?: string, limit = 50): EventRecord[] {
    const db = get_db(repoRoot);
    if (sessionId) {
        const stmt = db.prepare(`
            SELECT session_id, timestamp, level, event_type, message, metadata
            FROM events
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(sessionId, limit) as EventRecord[];
        db.close();
        return rows;
    }
    const stmt = db.prepare(`
        SELECT session_id, timestamp, level, event_type, message, metadata
        FROM events
        ORDER BY timestamp DESC
        LIMIT ?
    `);
    const rows = stmt.all(limit) as EventRecord[];
    db.close();
    return rows;
}

export function prune_events(repoRoot: string, olderThanDays: number): number {
    const db = get_db(repoRoot);
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`DELETE FROM events WHERE timestamp < ?`);
    const result = stmt.run(cutoff);
    db.close();
    return result.changes;
}

export function prune_sessions(repoRoot: string, olderThanDays: number): number {
    const db = get_db(repoRoot);
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`DELETE FROM sessions WHERE started_at < ?`);
    const result = stmt.run(cutoff);
    db.close();
    return result.changes;
}
