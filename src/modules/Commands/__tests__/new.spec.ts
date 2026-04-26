import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { create_sandbox } from '../useCases/new.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    get_repo_name: vi.fn(() => 'my-repo'),
    worktree_list: vi.fn(() => []),
    branch_exists: vi.fn(() => false),
    worktree_create: vi.fn(),
}));

vi.mock('../../AgentState/index.ts', () => ({
    write_state: vi.fn(),
}));

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), logger: { info: vi.fn(), error: vi.fn(), raw: vi.fn() }, success: vi.fn() };
});

vi.mock('../../TaskManagement/index.ts', () => ({
    to_slug: vi.fn((s: string) => s),
    derive_names: vi.fn(() => ({ branch: 'agent/test', worktreePath: '.agents/agent-test' })),
    next_duplicate_slug: vi.fn((s: string) => s),
    create_or_update_task_file: vi.fn(),
}));

vi.mock('./launch-agent.ts', () => ({
    run_agent_launch: vi.fn(() => 0),
}));

describe('new', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates sandbox successfully', () => {
        const result = create_sandbox({ slug: 'test', title: 'Test task', launch: false });
        expect(result).toBe(0);
    });
});
