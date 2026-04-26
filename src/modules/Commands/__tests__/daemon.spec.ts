import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/daemon.ts';
import { mkdirSync } from 'fs';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

describe('daemon', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mkdirSync('/tmp/repo/src', { recursive: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts daemon successfully', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });
});
