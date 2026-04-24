import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findFiles } from '../useCases/refactor.ts';

describe('refactor module', () => {
    describe('findFiles', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = mkdtempSync(join(tmpdir(), 'swarm-refactor-test-'));
        });

        afterEach(() => {
            rmSync(tempDir, { recursive: true, force: true });
        });

        it('finds ts and tsx files recursively', () => {
            mkdirSync(join(tempDir, 'sub'), { recursive: true });
            writeFileSync(join(tempDir, 'a.ts'), '', 'utf8');
            writeFileSync(join(tempDir, 'b.tsx'), '', 'utf8');
            writeFileSync(join(tempDir, 'c.js'), '', 'utf8');
            writeFileSync(join(tempDir, 'sub', 'd.ts'), '', 'utf8');

            const results = findFiles(tempDir);
            expect(results.sort()).toEqual([
                join(tempDir, 'a.ts'),
                join(tempDir, 'b.tsx'),
                join(tempDir, 'c.js'),
                join(tempDir, 'sub', 'd.ts'),
            ]);
        });

        it('ignores node_modules, dist, and .git', () => {
            mkdirSync(join(tempDir, 'node_modules'), { recursive: true });
            mkdirSync(join(tempDir, '.git'), { recursive: true });
            writeFileSync(join(tempDir, 'node_modules', 'lib.ts'), '', 'utf8');
            writeFileSync(join(tempDir, '.git', 'config.ts'), '', 'utf8');
            writeFileSync(join(tempDir, 'src.ts'), '', 'utf8');

            const results = findFiles(tempDir);
            expect(results).toEqual([join(tempDir, 'src.ts')]);
        });

        it('returns empty array for non-existent directory', () => {
            expect(findFiles('/nonexistent/path')).toEqual([]);
        });
    });
});
