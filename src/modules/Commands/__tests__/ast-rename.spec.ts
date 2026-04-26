import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/ast-rename.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

vi.mock('../../../utils/ast.ts', () => ({
    rename_symbol: vi.fn(() => ({ success: true, modifiedFiles: 1 })),
}));

describe('ast-rename', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when args are missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('renames symbol successfully', () => {
        process.argv = ['node', 'script', 'src/file.ts', 'oldName', 'newName'];
        expect(run()).toBe(0);
    });
});
