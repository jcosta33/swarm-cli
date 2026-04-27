import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { load_task_graph, run } from '../useCases/decompose.ts';

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        parse_args: vi.fn(),
        load_config: vi.fn(() => ({ defaultAgent: 'claude', defaultBaseBranch: 'main', agents: { claude: { command: 'node', args: [] } } })),
        red: vi.fn((t: string) => t),
        cyan: vi.fn((t: string) => t),
        green: vi.fn((t: string) => t),
        dim: vi.fn((t: string) => t),
        bold: vi.fn((t: string) => t),
    };
});

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    get_repo_name: vi.fn(() => 'repo'),
    // worktree_create now returns Result<{ path, branch }, AppError>.
    worktree_create: vi.fn((path: string, branch: string) => ({ ok: true, value: { path, branch } })),
    branch_exists: vi.fn(() => false),
}));

vi.mock('../../AgentState/index.ts', () => ({
    write_state: vi.fn(() => {}),
}));

vi.mock('../../TaskManagement/index.ts', () => ({
    create_or_update_task_file: vi.fn(() => {}),
    derive_names: vi.fn((slug: string) => ({ branch: `agent/${slug}`, worktreePath: `.agents/agent-${slug}` })),
    validate_dag: vi.fn(() => ({ valid: true })),
    topological_sort: vi.fn((tasks: unknown[]) => tasks),
}));

vi.mock('../../Adapters/index.ts', () => ({
    get_adapter: vi.fn(() => ({ build_args: (_slug: string, args: string[]) => args })),
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => '{"tasks": [{"id": "a", "description": "Task A", "dependencies": []}]}'),
        mkdirSync: vi.fn(() => {}),
    };
});

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        spawn: vi.fn(() => ({ pid: 123, on: vi.fn(), unref: vi.fn() })),
    };
});

import { parse_args } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import { existsSync, readFileSync } from 'fs';
import { validate_dag } from '../../TaskManagement/index.ts';

describe('decompose module', () => {
    describe('load_task_graph', () => {
        it('parses valid task graph', () => {
            const result = load_task_graph('/tmp/graph.json');
            expect(result).toEqual([{ id: 'a', description: 'Task A', dependencies: [] }]);
        });

        it('throws on invalid JSON', () => {
            vi.mocked(readFileSync).mockReturnValueOnce('not json');
            expect(() => load_task_graph('/tmp/graph.json')).toThrow('Invalid JSON');
        });

        it('throws when tasks is not an array', () => {
            vi.mocked(readFileSync).mockReturnValueOnce('{"tasks": "nope"}');
            expect(() => load_task_graph('/tmp/graph.json')).toThrow('expected { tasks: [...] }');
        });

        it('throws on invalid task shape', () => {
            vi.mocked(readFileSync).mockReturnValueOnce('{"tasks": [{"id": "a"}]}');
            expect(() => load_task_graph('/tmp/graph.json')).toThrow('Invalid task at index 0');
        });
    });

    describe('run', () => {
        beforeEach(() => {
            vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "Task A", "dependencies": []}]}');
            vi.mocked(validate_dag).mockReturnValue({ valid: true });
        });

        afterEach(() => {
            vi.restoreAllMocks();
            vi.mocked(validate_dag).mockReturnValue({ valid: true });
        });

        it('returns 1 when not in a git repo', () => {
            vi.mocked(get_repo_root).mockImplementation(() => { throw new Error('not a repo'); });
            expect(run()).toBe(1);
        });

        it('returns 1 when args are missing', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: [], flags: new Map() });
            process.argv = ['node', 'script'];
            expect(run()).toBe(1);
        });

        it('returns 1 when file not found', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map() });
            vi.mocked(existsSync).mockReturnValue(false);
            process.argv = ['node', 'script'];
            expect(run()).toBe(1);
        });

        it('returns 1 when task graph is invalid', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map() });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('not json');
            process.argv = ['node', 'script'];
            expect(run()).toBe(1);
        });

        it('returns 1 when DAG validation fails', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map() });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "A", "dependencies": ["b"]}, {"id": "b", "description": "B", "dependencies": ["a"]}]}');
            vi.mocked(validate_dag).mockReturnValue({ valid: false, cycle: ['a', 'b'] });
            process.argv = ['node', 'script'];
            expect(run()).toBe(1);
        });

        it('returns 0 on dry run', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map([['dry-run', true]]) });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "Task A", "dependencies": []}]}');
            process.argv = ['node', 'script'];
            expect(run()).toBe(0);
        });

        it('returns 0 without execute flag', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map() });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "Task A", "dependencies": []}]}');
            process.argv = ['node', 'script'];
            expect(run()).toBe(0);
        });

        it('returns 0 with execute flag', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map([['execute', true]]) });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "Task A", "dependencies": []}]}');
            process.argv = ['node', 'script'];
            expect(run()).toBe(0);
        });

        it('truncates tasks when max-tasks exceeded', () => {
            vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
            vi.mocked(parse_args).mockReturnValue({ positional: ['graph.json'], flags: new Map([['max-tasks', '2']]) });
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('{"tasks": [{"id": "a", "description": "A", "dependencies": []}, {"id": "b", "description": "B", "dependencies": []}, {"id": "c", "description": "C", "dependencies": []}, {"id": "d", "description": "D", "dependencies": []}, {"id": "e", "description": "E", "dependencies": []}]}');
            process.argv = ['node', 'script'];
            expect(run()).toBe(0);
        });
    });
});
