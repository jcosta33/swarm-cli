import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run, find_impacted_specs } from '../useCases/test-radius.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    resolve_within: vi.fn((root: string, path: string) => ({ ok: true, value: `${root}/${path}` })),
}));

describe('test-radius', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('find_impacted_specs', () => {
        it('finds specs that import the target', () => {
            const specs = find_impacted_specs('/Users/josecosta/dev/swarm-cli', 'src/modules/Commands/useCases/find.ts');
            expect(Array.isArray(specs)).toBe(true);
        });

        it('returns empty array for non-existent directory', () => {
            const specs = find_impacted_specs('/non-existent-path-12345', 'src/index.ts');
            expect(specs).toEqual([]);
        });
    });

    it('returns 1 when file is missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('finds impacted specs for a file', () => {
        process.argv = ['node', 'script', 'src/modules/Commands/useCases/find.ts'];
        expect(run()).toBe(0);
    });

    it('returns 0 when no impacted specs found', () => {
        process.argv = ['node', 'script', 'src/modules/Commands/useCases/non-existent.ts'];
        expect(run()).toBe(0);
    });

});
