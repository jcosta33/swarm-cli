import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generate_context_map } from '../useCases/context.ts';

describe('context module', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'swarm-context-test-'));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('generates context map for ts files with exports', () => {
        const srcDir = join(tempDir, 'src');
        mkdirSync(srcDir, { recursive: true });
        writeFileSync(join(srcDir, 'utils.ts'), 'export function helper() {}\nexport const PI = 3.14;', 'utf8');

        const map = generate_context_map(tempDir, 'src');
        expect(Object.keys(map)).toContain(join('src', 'utils.ts'));
        expect(map[join('src', 'utils.ts')]).toContain('function helper');
        expect(map[join('src', 'utils.ts')]).toContain('const PI');
    });

    it('ignores files without exports', () => {
        const srcDir = join(tempDir, 'src');
        mkdirSync(srcDir, { recursive: true });
        writeFileSync(join(srcDir, 'plain.ts'), 'const x = 1;', 'utf8');

        const map = generate_context_map(tempDir, 'src');
        expect(Object.keys(map)).toHaveLength(0);
    });

    it('ignores node_modules and dist directories', () => {
        const srcDir = join(tempDir, 'src');
        const nodeModulesDir = join(srcDir, 'node_modules');
        mkdirSync(nodeModulesDir, { recursive: true });
        writeFileSync(join(nodeModulesDir, 'lib.ts'), 'export function lib() {}', 'utf8');

        const map = generate_context_map(tempDir, 'src');
        expect(Object.keys(map)).toHaveLength(0);
    });

    it('respects max depth of 3', () => {
        // depth 3 is still explored (a=0, b=1, c=2, d=3)
        const depth3Dir = join(tempDir, 'a', 'b', 'c', 'd');
        mkdirSync(depth3Dir, { recursive: true });
        writeFileSync(join(depth3Dir, 'deep.ts'), 'export function deep() {}', 'utf8');

        const map = generate_context_map(tempDir, 'a');
        expect(Object.keys(map)).toContain(join('a', 'b', 'c', 'd', 'deep.ts'));

        // depth 4 is not explored (a=0, b=1, c=2, d=3, e=4)
        const depth4Dir = join(tempDir, 'a2', 'b', 'c', 'd', 'e');
        mkdirSync(depth4Dir, { recursive: true });
        writeFileSync(join(depth4Dir, 'deeper.ts'), 'export function deeper() {}', 'utf8');

        const map2 = generate_context_map(tempDir, 'a2');
        expect(Object.keys(map2)).toHaveLength(0);
    });
});
