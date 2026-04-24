import { describe, expect, it } from 'vitest';
import { escape_regex } from '../useCases/find.ts';

describe('find module', () => {
    describe('escape_regex', () => {
        it('escapes special regex characters', () => {
            expect(escape_regex('a.b')).toBe('a\\.b');
            expect(escape_regex('a*b')).toBe('a\\*b');
            expect(escape_regex('a+b')).toBe('a\\+b');
            expect(escape_regex('a?b')).toBe('a\\?b');
            expect(escape_regex('a^b')).toBe('a\\^b');
            expect(escape_regex('a$b')).toBe('a\\$b');
            expect(escape_regex('a(b')).toBe('a\\(b');
            expect(escape_regex('a)b')).toBe('a\\)b');
            expect(escape_regex('a[b')).toBe('a\\[b');
            expect(escape_regex('a]b')).toBe('a\\]b');
            expect(escape_regex('a{b')).toBe('a\\{b');
            expect(escape_regex('a}b')).toBe('a\\}b');
            expect(escape_regex('a|b')).toBe('a\\|b');
            expect(escape_regex('a\\b')).toBe('a\\\\b');
        });

        it('leaves normal characters unchanged', () => {
            expect(escape_regex('hello-world_123')).toBe('hello-world_123');
        });

        it('handles empty string', () => {
            expect(escape_regex('')).toBe('');
        });
    });
});
