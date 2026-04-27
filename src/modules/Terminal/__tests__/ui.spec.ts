import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render_dashboard } from '../useCases/ui.ts';

vi.mock('../../Workspace/index.ts', () => ({
    worktree_list: vi.fn(),
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

vi.mock('../../AgentState/index.ts', () => ({
    read_state: vi.fn(() => ({})),
    is_process_running: vi.fn(() => true),
}));

import { worktree_list } from '../../Workspace/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import { read_state, is_process_running } from '../../AgentState/index.ts';
import { run } from '../useCases/ui.ts';

describe('ui', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.mocked(read_state).mockReturnValue({});
        vi.mocked(is_process_running).mockReturnValue(true);
        vi.mocked(get_repo_root).mockReturnValue('/tmp/repo');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('run', () => {
        it('starts dashboard successfully', () => {
            vi.useFakeTimers();
            vi.mocked(worktree_list).mockReturnValue([]);
            run();
            expect(console.log).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('exits when not in a git repo', () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
            vi.mocked(get_repo_root).mockImplementation(() => { throw new Error('not a repo'); });
            run();
            expect(exitSpy).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });

        it('clears interval on SIGINT', () => {
            vi.useFakeTimers();
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
            vi.mocked(worktree_list).mockReturnValue([]);
            run();
            const sigintHandlers = process.listeners('SIGINT');
            const lastHandler = sigintHandlers[sigintHandlers.length - 1];
            if (lastHandler) lastHandler();
            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
            exitSpy.mockRestore();
            vi.useRealTimers();
        });
    });

    it('renders dashboard with sandboxes', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalled();
    });

    it('renders dashboard with no sandboxes', () => {
        vi.mocked(worktree_list).mockReturnValue([]);
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalled();
    });

    it('shows RUNNING when process is alive', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(read_state).mockReturnValue({ foo: { status: 'running', pid: 1234 } });
        vi.mocked(is_process_running).mockReturnValue(true);
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('RUNNING'));
    });

    it('shows CRASHED when process is dead', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(read_state).mockReturnValue({ foo: { status: 'running', pid: 1234 } });
        vi.mocked(is_process_running).mockReturnValue(false);
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CRASHED'));
    });

    it('shows LAUNCHED when no pid', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(read_state).mockReturnValue({ foo: { status: 'running' } });
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('LAUNCHED'));
    });

    it('shows custom status when not running', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(read_state).mockReturnValue({ foo: { status: 'created' } });
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CREATED'));
    });

    it('shows IDLE for main branch', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo', branch: 'main', head: 'abc' },
        ]);
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('IDLE'));
    });

    it('includes backend and pid info', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(read_state).mockReturnValue({ foo: { status: 'running', pid: 1234, backend: 'terminal' } });
        render_dashboard('/tmp/repo');
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('terminal'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1234'));
    });
});
