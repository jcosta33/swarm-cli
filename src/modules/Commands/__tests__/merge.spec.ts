import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/merge.ts';
import { spawnSync } from 'child_process';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), spawnSync: vi.fn() };
});

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        parse_args: vi.fn(),
        red: vi.fn((t: string) => t),
        green: vi.fn((t: string) => t),
        dim: vi.fn((t: string) => t),
    };
});

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

import { parse_args } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

describe('merge module', () => {
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

    it('returns 1 when args are missing', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map() });
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 1 on merge conflict', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: ['feature'], flags: new Map() });
        vi.mocked(spawnSync).mockReturnValueOnce({ status: 1, stdout: 'CONFLICT (content): Merge conflict in file.ts\n', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 0 on successful merge', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: ['feature'], flags: new Map() });
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 0 on empty merge', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: ['feature'], flags: new Map() });
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 1 when commit fails after merge', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: ['feature'], flags: new Map() });
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('cascade returns 0 when no branches match', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['cascade', 'agent/*']]) });
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('cascade merges branches successfully', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['cascade', 'agent/*']]) });
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0, stdout: '  agent/foo\n  agent/bar\n', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('cascade returns 1 when merge fails', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['cascade', 'agent/*']]) });
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0, stdout: '  agent/foo\n', stderr: '' } as ReturnType<typeof spawnSync>)
            .mockReturnValueOnce({ status: 1, stdout: 'CONFLICT\n', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 1 when cascade pattern is missing', () => {
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
        vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map([['cascade', true]]) });
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });
});
