import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    record_session,
    record_event,
    query_sessions,
    query_events,
    prune_events,
    prune_sessions,
} from '../services/telemetry.ts';

describe('telemetry module', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'swarm-telemetry-test-'));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('records and queries a session', () => {
        record_session(tempDir, {
            id: 'sess-1',
            slug: 'test-slug',
            agent: 'claude',
            model: null,
            started_at: new Date().toISOString(),
            finished_at: null,
            exit_code: null,
        });

        const sessions = query_sessions(tempDir, 10);
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.slug).toBe('test-slug');
        expect(sessions[0]?.agent).toBe('claude');
    });

    it('updates session on duplicate id', () => {
        const id = 'sess-dup';
        const started = new Date().toISOString();
        record_session(tempDir, {
            id,
            slug: 'test',
            agent: 'claude',
            model: null,
            started_at: started,
            finished_at: null,
            exit_code: null,
        });

        const finished = new Date().toISOString();
        record_session(tempDir, {
            id,
            slug: 'test',
            agent: 'claude',
            model: null,
            started_at: started,
            finished_at: finished,
            exit_code: 0,
        });

        const sessions = query_sessions(tempDir, 10);
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.finished_at).toBe(finished);
        expect(sessions[0]?.exit_code).toBe(0);
    });

    it('records and queries events', () => {
        record_session(tempDir, {
            id: 'sess-ev',
            slug: 'ev-slug',
            agent: 'claude',
            model: null,
            started_at: new Date().toISOString(),
            finished_at: null,
            exit_code: null,
        });

        record_event(tempDir, {
            session_id: 'sess-ev',
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'start',
            message: 'Agent started',
            metadata: null,
        });

        const events = query_events(tempDir, 'sess-ev', 10);
        expect(events).toHaveLength(1);
        expect(events[0]?.message).toBe('Agent started');
    });

    it('queries all events when no sessionId is provided', () => {
        record_session(tempDir, {
            id: 'sess-1',
            slug: 's1',
            agent: 'claude',
            model: null,
            started_at: new Date().toISOString(),
            finished_at: null,
            exit_code: null,
        });
        record_session(tempDir, {
            id: 'sess-2',
            slug: 's2',
            agent: 'gemini',
            model: null,
            started_at: new Date().toISOString(),
            finished_at: null,
            exit_code: null,
        });

        record_event(tempDir, {
            session_id: 'sess-1',
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'start',
            message: 'm1',
            metadata: null,
        });
        record_event(tempDir, {
            session_id: 'sess-2',
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'start',
            message: 'm2',
            metadata: null,
        });

        const events = query_events(tempDir, undefined, 10);
        expect(events).toHaveLength(2);
    });

    it('prunes old sessions and events', () => {
        const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
        record_session(tempDir, {
            id: 'sess-old',
            slug: 'old',
            agent: 'claude',
            model: null,
            started_at: oldDate,
            finished_at: oldDate,
            exit_code: 0,
        });
        record_event(tempDir, {
            session_id: 'sess-old',
            timestamp: oldDate,
            level: 'info',
            event_type: 'start',
            message: 'old event',
            metadata: null,
        });

        // Prune events first to avoid FK constraint, then sessions
        const eventsDeleted = prune_events(tempDir, 30);
        const sessionsDeleted = prune_sessions(tempDir, 30);

        expect(eventsDeleted).toBe(1);
        expect(sessionsDeleted).toBe(1);

        expect(query_sessions(tempDir, 10)).toHaveLength(0);
        expect(query_events(tempDir, undefined, 10)).toHaveLength(0);
    });

    it('does not prune recent records', () => {
        record_session(tempDir, {
            id: 'sess-new',
            slug: 'new',
            agent: 'claude',
            model: null,
            started_at: new Date().toISOString(),
            finished_at: null,
            exit_code: null,
        });

        const sessionsDeleted = prune_sessions(tempDir, 30);
        expect(sessionsDeleted).toBe(0);
        expect(query_sessions(tempDir, 10)).toHaveLength(1);
    });
});
