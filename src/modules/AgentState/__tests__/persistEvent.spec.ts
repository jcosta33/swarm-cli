import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { persist_event, read_events } from '../useCases/persistEvent.ts';

describe('persist_event / read_events', () => {
    let repoRoot: string;

    beforeEach(() => {
        repoRoot = mkdtempSync(join(tmpdir(), 'swarm-events-'));
    });

    afterEach(() => {
        rmSync(repoRoot, { recursive: true, force: true });
    });

    it('appends an NDJSON line per event and round-trips through read_events', () => {
        persist_event(repoRoot, 'sandbox.created', { repoRoot, slug: 'foo', branch: 'agent/foo', worktreePath: '/tmp/wt-foo' });
        persist_event(repoRoot, 'sandbox.removed', { repoRoot, slug: 'foo' });

        const events = read_events(repoRoot);
        expect(events).toHaveLength(2);
        expect(events[0].event).toBe('sandbox.created');
        expect(events[0].payload.slug).toBe('foo');
        expect(events[1].event).toBe('sandbox.removed');
        expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('writes a literal trailing newline so concurrent appends do not corrupt prior lines', () => {
        persist_event(repoRoot, 'sandbox.created', { repoRoot, slug: 'foo' });
        const raw = readFileSync(join(repoRoot, '.agents', 'logs', 'events.ndjson'), 'utf8');
        expect(raw.endsWith('\n')).toBe(true);
        // Each line must be parseable as JSON.
        for (const line of raw.split('\n').filter(Boolean)) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });

    it('returns the most recent N events when limit is positive', () => {
        for (let i = 0; i < 5; i++) {
            persist_event(repoRoot, 'sandbox.created', { repoRoot, slug: `s-${String(i)}` });
        }
        const events = read_events(repoRoot, 2);
        expect(events).toHaveLength(2);
        expect(events[0].payload.slug).toBe('s-3');
        expect(events[1].payload.slug).toBe('s-4');
    });

    it('returns every event when limit is 0', () => {
        for (let i = 0; i < 3; i++) {
            persist_event(repoRoot, 'sandbox.created', { repoRoot, slug: `s-${String(i)}` });
        }
        expect(read_events(repoRoot, 0)).toHaveLength(3);
    });

    it('skips malformed lines instead of throwing', () => {
        const path = join(repoRoot, '.agents', 'logs', 'events.ndjson');
        persist_event(repoRoot, 'sandbox.created', { repoRoot, slug: 'good' });
        // Simulate a partially-flushed write.
        writeFileSync(path, `${readFileSync(path, 'utf8')}{not-json\n`, 'utf8');
        persist_event(repoRoot, 'sandbox.removed', { repoRoot, slug: 'good' });

        const events = read_events(repoRoot);
        expect(events).toHaveLength(2);
        expect(events.map((e) => e.event)).toEqual(['sandbox.created', 'sandbox.removed']);
    });

    it('returns [] when the log file does not exist yet', () => {
        expect(read_events(repoRoot)).toEqual([]);
    });

    it('does not throw if the parent directory is on a read-only path (silent drop)', () => {
        // Pass a non-existent root the function cannot create. mkdir on macOS
        // silently fails on /System; we simulate with a path with NUL byte
        // which Node refuses to mkdir.
        expect(() => persist_event('/dev/null/cannot-create', 'sandbox.created', { repoRoot: 'x', slug: 'y' })).not.toThrow();
    });
});
