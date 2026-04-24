import { describe, expect, it } from 'vitest';
import { calculateComplexity } from '../useCases/complexity.ts';

describe('calculateComplexity', () => {
    it('returns base score for empty content', () => {
        expect(calculateComplexity('')).toBe(1);
    });

    it('counts if statements', () => {
        const code = 'if (a) {}\nif (b) {}\nif (c) {}';
        expect(calculateComplexity(code)).toBe(4); // 1 base + 3 ifs
    });

    it('counts else if statements', () => {
        const code = 'if (a) {} else if (b) {}';
        expect(calculateComplexity(code)).toBe(4); // 1 base + 1 if + 1 else if (else if also matches if pattern)
    });

    it('counts for and while loops', () => {
        const code = 'for (let i = 0; i < 10; i++) {}\nwhile (true) {}';
        expect(calculateComplexity(code)).toBe(3); // 1 base + 2 loops
    });

    it('counts catch blocks', () => {
        const code = 'try {} catch (e) {}';
        expect(calculateComplexity(code)).toBe(2); // 1 base + 1 catch
    });

    it('counts logical operators', () => {
        const code = 'const a = b && c;\nconst d = e || f;\nconst g = h ? i : j;';
        expect(calculateComplexity(code)).toBe(4); // 1 base + 3 operators
    });

    it('counts switch cases', () => {
        const code = 'switch (x) { case 1: break; case 2: break; case 3: break; }';
        expect(calculateComplexity(code)).toBe(4); // 1 base + 3 cases
    });

    it('returns excellent score for simple code', () => {
        const code = 'const x = 1;';
        expect(calculateComplexity(code)).toBe(1);
    });

    it('accumulates multiple complexity factors', () => {
        const code = `
            if (a) {
                for (let i = 0; i < 10; i++) {
                    if (b && c) {
                        try {} catch (e) {}
                    }
                }
            }
        `;
        const score = calculateComplexity(code);
        expect(score).toBeGreaterThan(5);
    });
});
