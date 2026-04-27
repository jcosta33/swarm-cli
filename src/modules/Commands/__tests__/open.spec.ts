import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/open.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    find_worktree_for_branch: vi.fn(),
}));

vi.mock('../../AgentState/index.ts', () => ({
    read_state: vi.fn(() => ({})),
}));

vi.mock('../useCases/launch-agent.ts', () => ({
    run_agent_launch: vi.fn(() => 0),
}));

import { find_worktree_for_branch } from '../../Workspace/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

describe("open", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when not in a git repo', () => {
        vi.mocked(get_repo_root).mockImplementation(() => { throw new Error('not a repo'); });
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 1 when slug is missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 1 when worktree not found', () => {
        vi.mocked(find_worktree_for_branch).mockReturnValue(null);
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(1);
    });

    it('opens sandbox successfully', () => {
        vi.mocked(find_worktree_for_branch).mockReturnValue('/tmp/repo/.agents/agent-foo');
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(0);
    });
});
