import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run, findFiles } from '../useCases/arch.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

describe('arch', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('findFiles', () => {
        it('finds ts files recursively', () => {
            const files = findFiles('src/modules/Commands/useCases');
            expect(files.length).toBeGreaterThan(0);
            expect(files.some(f => f.endsWith('.ts'))).toBe(true);
        });

        it('returns empty for non-existent directory', () => {
            const files = findFiles('/nonexistent-dir-12345');
            expect(files).toEqual([]);
        });
    });

    it('returns 0 when no violations found', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });
});
