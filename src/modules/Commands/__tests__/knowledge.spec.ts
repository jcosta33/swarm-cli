import { describe, expect, it } from 'vitest';
import { scoreContent } from '../useCases/knowledge.ts';

describe('scoreContent', () => {
    it('returns 0 when no keywords match', () => {
        expect(scoreContent('hello world', ['foo', 'bar'])).toBe(0);
    });

    it('returns 1 when one keyword matches', () => {
        expect(scoreContent('hello world', ['hello', 'foo'])).toBe(1);
    });

    it('returns count of all matching keywords', () => {
        expect(scoreContent('hello world', ['hello', 'world', 'foo'])).toBe(2);
    });

    it('is case-insensitive', () => {
        expect(scoreContent('Hello World', ['hello', 'WORLD'])).toBe(2);
    });

    it('handles empty keywords array', () => {
        expect(scoreContent('hello world', [])).toBe(0);
    });

    it('handles empty content', () => {
        expect(scoreContent('', ['hello'])).toBe(0);
    });
});
