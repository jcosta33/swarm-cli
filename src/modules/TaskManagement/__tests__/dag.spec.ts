import { describe, expect, it } from 'vitest';
import { validate_dag, topological_sort } from '../useCases/dag.ts';

describe('dag utilities', () => {
    describe('validate_dag', () => {
        it('returns valid for empty task list', () => {
            expect(validate_dag([])).toEqual({ valid: true });
        });

        it('returns valid for tasks with no dependencies', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: [] },
                { id: 'b', description: 'Task B', dependencies: [] },
            ];
            expect(validate_dag(tasks)).toEqual({ valid: true });
        });

        it('returns valid for linear dependency chain', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: [] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
                { id: 'c', description: 'Task C', dependencies: ['b'] },
            ];
            expect(validate_dag(tasks)).toEqual({ valid: true });
        });

        it('returns valid for diamond dependency graph', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: [] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
                { id: 'c', description: 'Task C', dependencies: ['a'] },
                { id: 'd', description: 'Task D', dependencies: ['b', 'c'] },
            ];
            expect(validate_dag(tasks)).toEqual({ valid: true });
        });

        it('returns invalid for missing dependency', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: ['nonexistent'] },
            ];
            const result = validate_dag(tasks);
            expect(result.valid).toBe(false);
        });

        it('returns invalid for simple cycle', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: ['b'] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
            ];
            const result = validate_dag(tasks);
            expect(result.valid).toBe(false);
            expect(result.cycle).toBeDefined();
        });

        it('returns invalid for longer cycle', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: ['b'] },
                { id: 'b', description: 'Task B', dependencies: ['c'] },
                { id: 'c', description: 'Task C', dependencies: ['a'] },
            ];
            const result = validate_dag(tasks);
            expect(result.valid).toBe(false);
        });
    });

    describe('topological_sort', () => {
        it('returns empty array for empty input', () => {
            expect(topological_sort([])).toEqual([]);
        });

        it('returns tasks in order for no dependencies', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: [] },
                { id: 'b', description: 'Task B', dependencies: [] },
            ];
            const sorted = topological_sort(tasks);
            expect(sorted).toHaveLength(2);
            expect(sorted.map((t) => t.id)).toContain('a');
            expect(sorted.map((t) => t.id)).toContain('b');
        });

        it('respects linear dependencies', () => {
            const tasks = [
                { id: 'c', description: 'Task C', dependencies: ['b'] },
                { id: 'a', description: 'Task A', dependencies: [] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
            ];
            const sorted = topological_sort(tasks);
            const ids = sorted.map((t) => t.id);
            expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
            expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'));
        });

        it('respects diamond dependencies', () => {
            const tasks = [
                { id: 'd', description: 'Task D', dependencies: ['b', 'c'] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
                { id: 'c', description: 'Task C', dependencies: ['a'] },
                { id: 'a', description: 'Task A', dependencies: [] },
            ];
            const sorted = topological_sort(tasks);
            const ids = sorted.map((t) => t.id);
            expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
            expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
            expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
            expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
        });

        it('throws for cyclic dependencies', () => {
            const tasks = [
                { id: 'a', description: 'Task A', dependencies: ['b'] },
                { id: 'b', description: 'Task B', dependencies: ['a'] },
            ];
            expect(() => topological_sort(tasks)).toThrow('Cycle detected');
        });
    });
});
