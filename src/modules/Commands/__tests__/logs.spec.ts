import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/logs.ts';

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        parse_args: vi.fn(),
        red: vi.fn((t: string) => t),
        green: vi.fn((t: string) => t),
        dim: vi.fn((t: string) => t),
        logger: { info: vi.fn(), error: vi.fn(), raw: vi.fn(), warn: vi.fn() },
    };
});

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

vi.mock('../../AgentState/index.ts', () => ({
    prune_events: vi.fn(() => 5),
    prune_sessions: vi.fn(() => 3),
    query_sessions: vi.fn(() => [
        { slug: 'foo', agent: 'claude', started_at: '2024-01-01T00:00:00Z', finished_at: '2024-01-01T00:01:00Z', exit_code: 0 },
        { slug: 'bar', agent: 'codex', started_at: '2024-01-01T01:00:00Z', finished_at: null, exit_code: null },
    ]),
}));

import { parse_args } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import { query_sessions } from '../../AgentState/index.ts';

describe('logs module', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when not in a git repo', () => {
        vi.mocked(get_repo_root).mockImplementation(() => { throw new Error('not a repo'); });
        expect(run()).toBe(1);
    });

    it('prunes logs and returns 0', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['prune', '7']]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 1 for invalid prune value', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['prune', 'abc']]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 0 with follow flag', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['follow', true]]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 0 when no sessions', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map() });
        vi.mocked(query_sessions).mockReturnValue([]);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 0 and prints sessions', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map() });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('filters by agent', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['agent', 'claude']]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('filters by slug', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['slug', 'foo']]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('outputs json', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['json', true]]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });
});
