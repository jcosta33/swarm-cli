import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render_dashboard } from '../useCases/ui.ts';

vi.mock('../../Workspace/index.ts', () => ({
    worktree_list: vi.fn(),
}));

vi.mock('../../AgentState/index.ts', () => ({
    read_state: vi.fn(() => ({})),
    is_process_running: vi.fn(() => true),
}));

import { worktree_list } from '../../Workspace/index.ts';

describe('ui', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
});
