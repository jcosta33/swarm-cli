import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/chat.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

vi.mock('../../AgentState/index.ts', () => ({
    read_state: vi.fn(() => ({ foo: { status: 'running' } })),
}));

vi.mock('../../Terminal/index.ts', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), logger: { info: vi.fn(), error: vi.fn(), raw: vi.fn() } };
});

describe('chat', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when slug is missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('reads chat log when no message flag', () => {
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(0);
    });

    it('sends chat message with --message flag', () => {
        process.argv = ['node', 'script', 'foo', '--message', 'hello world'];
        expect(run()).toBe(0);
    });
});
