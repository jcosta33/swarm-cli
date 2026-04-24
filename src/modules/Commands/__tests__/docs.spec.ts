import { describe, expect, it } from 'vitest';
import { extractDocs } from '../useCases/docs.ts';

describe('extractDocs', () => {
    it('returns empty array when no doc blocks exist', () => {
        const code = 'const x = 1;\nfunction foo() {}';
        expect(extractDocs(code)).toEqual([]);
    });

    it('extracts a single JSDoc block', () => {
        const code = `/**
 * A simple function.
 */
function foo() {}`;
        const docs = extractDocs(code);
        expect(docs).toHaveLength(1);
        expect(docs[0]).toContain('A simple function.');
    });

    it('extracts multiple JSDoc blocks', () => {
        const code = `/**
 * First doc.
 */
function a() {}

/**
 * Second doc.
 */
function b() {}`;
        const docs = extractDocs(code);
        expect(docs).toHaveLength(2);
        expect(docs[0]).toContain('First doc.');
        expect(docs[1]).toContain('Second doc.');
    });

    it('preserves multiline content inside doc block', () => {
        const code = `/**
 * Line one.
 * Line two.
 * Line three.
 */
const x = 1;`;
        const docs = extractDocs(code);
        expect(docs).toHaveLength(1);
        expect(docs[0]).toContain('Line one.');
        expect(docs[0]).toContain('Line two.');
        expect(docs[0]).toContain('Line three.');
    });

    it('ignores regular block comments', () => {
        const code = `/* Not a JSDoc */
const x = 1;`;
        expect(extractDocs(code)).toEqual([]);
    });

    it('ignores inline single-line comments', () => {
        const code = '// This is a comment\nconst x = 1;';
        expect(extractDocs(code)).toEqual([]);
    });
});
