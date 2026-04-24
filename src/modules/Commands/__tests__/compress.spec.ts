import { describe, expect, it } from 'vitest';
import { skeletonize } from '../useCases/compress.ts';

describe('compress module', () => {
    describe('skeletonize', () => {
        it('keeps import and export lines', () => {
            const content = "import { x } from 'y';\nexport function foo() {}";
            const result = skeletonize(content);
            expect(result).toContain("import { x } from 'y';");
            expect(result).toContain('export function foo() {}');
        });

        it('keeps JSDoc comments', () => {
            const content = `/**\n * A helper function.\n */\nfunction helper() {}`;
            const result = skeletonize(content);
            expect(result).toContain('/**');
            expect(result).toContain(' * A helper function.');
            expect(result).toContain(' */');
        });

        it('keeps type and interface declarations', () => {
            const content = 'interface Config {\n  port: number;\n}\ntype ID = string;';
            const result = skeletonize(content);
            expect(result).toContain('interface Config {');
            expect(result).toContain('type ID = string;');
        });

        it('keeps closing braces', () => {
            const content = 'function foo() {\n  return 1;\n}';
            const result = skeletonize(content);
            expect(result).toContain('function foo() {');
            expect(result).toContain('}');
            expect(result).not.toContain('return 1;');
        });

        it('strips function bodies', () => {
            const content = `function compute() {
  const x = 1;
  const y = 2;
  return x + y;
}`;
            const result = skeletonize(content);
            expect(result).toContain('function compute() {');
            expect(result).toContain('}');
            expect(result).not.toContain('const x = 1;');
            expect(result).not.toContain('return x + y;');
        });
    });
});
