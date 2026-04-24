import { describe, expect, it } from 'vitest';
import { parseEpicTasks } from '../useCases/epic.ts';

describe('parseEpicTasks', () => {
    it('returns empty array for empty content', () => {
        expect(parseEpicTasks('')).toEqual([]);
    });

    it('parses dash-prefixed tasks', () => {
        const content = '- Task one\n- Task two\n- Task three';
        expect(parseEpicTasks(content)).toEqual(['Task one', 'Task two', 'Task three']);
    });

    it('parses asterisk-prefixed tasks', () => {
        const content = '* Task one\n* Task two';
        expect(parseEpicTasks(content)).toEqual(['Task one', 'Task two']);
    });

    it('ignores non-list lines', () => {
        const content = '# Heading\n- Task one\nSome paragraph\n- Task two';
        expect(parseEpicTasks(content)).toEqual(['Task one', 'Task two']);
    });

    it('ignores empty list items', () => {
        const content = '- Task one\n- \n- Task two';
        expect(parseEpicTasks(content)).toEqual(['Task one', 'Task two']);
    });

    it('trims whitespace from task names', () => {
        const content = '-   Task with spaces   ';
        expect(parseEpicTasks(content)).toEqual(['Task with spaces']);
    });

    it('handles mixed dash and asterisk prefixes', () => {
        const content = '- Dash task\n* Asterisk task\n- Another dash';
        expect(parseEpicTasks(content)).toEqual(['Dash task', 'Asterisk task', 'Another dash']);
    });
});
