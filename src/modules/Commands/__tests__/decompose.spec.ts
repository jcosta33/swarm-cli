import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { load_task_graph } from '../useCases/decompose.ts';

describe('decompose module', () => {
    describe('load_task_graph', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = mkdtempSync(join(tmpdir(), 'swarm-decompose-test-'));
        });

        afterEach(() => {
            rmSync(tempDir, { recursive: true, force: true });
        });

        it('loads a valid task graph', () => {
            const path = join(tempDir, 'graph.json');
            writeFileSync(path, JSON.stringify({
                tasks: [
                    { id: 'a', description: 'Task A', dependencies: [] },
                    { id: 'b', description: 'Task B', dependencies: ['a'] },
                ],
            }), 'utf8');

            const tasks = load_task_graph(path);
            expect(tasks).toHaveLength(2);
            expect(tasks[0]?.id).toBe('a');
            expect(tasks[1]?.dependencies).toEqual(['a']);
        });

        it('throws when file is not valid JSON object', () => {
            const path = join(tempDir, 'bad.json');
            writeFileSync(path, '[]', 'utf8');
            expect(() => load_task_graph(path)).toThrow('expected object');
        });

        it('throws when tasks field is missing', () => {
            const path = join(tempDir, 'missing.json');
            writeFileSync(path, JSON.stringify({ meta: 'data' }), 'utf8');
            expect(() => load_task_graph(path)).toThrow('expected { tasks: [...] }');
        });
    });
});
