import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/logs.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

vi.mock('../../AgentState/services/telemetry.ts', () => ({
    query_sessions: vi.fn(() => []),
    prune_events: vi.fn(() => 0),
    prune_sessions: vi.fn(() => 0),
}));

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), logger: { info: vi.fn(), error: vi.fn(), raw: vi.fn() } };
});

import { query_sessions } from '../../AgentState/services/telemetry.ts';

describe('logs', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 0 when no sessions exist', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('filters sessions by slug', () => {
        vi.mocked(query_sessions).mockReturnValue([
            { id: '1', slug: 'foo', agent: 'claude', started_at: '2024-01-01', finished_at: null, exit_code: null },
        ]);
        process.argv = ['node', 'script', '--slug', 'foo'];
        expect(run()).toBe(0);
    });

    it('outputs JSON when --json flag is set', () => {
        vi.mocked(query_sessions).mockReturnValue([
            { id: '1', slug: 'foo', agent: 'claude', started_at: '2024-01-01', finished_at: null, exit_code: null },
        ]);
        process.argv = ['node', 'script', '--json'];
        expect(run()).toBe(0);
    });

    it('prunes old sessions', () => {
        process.argv = ['node', 'script', '--prune', '30'];
        expect(run()).toBe(0);
    });

    it('returns 1 for invalid --prune value', () => {
        process.argv = ['node', 'script', '--prune', 'abc'];
        expect(run()).toBe(1);
    });
});
