import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clack/prompts', () => ({
    intro: vi.fn(),
    outro: vi.fn(),
    log: { warn: vi.fn(), message: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    confirm: vi.fn(),
    isCancel: vi.fn(),
    cancel: vi.fn(),
    text: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        cpSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        spawnSync: vi.fn(),
    };
});

import * as clack from '@clack/prompts';
import { existsSync, mkdirSync, cpSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { cmd_init } from '../useCases/init.ts';

describe('cmd_init', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('aborts when user declines re-initialization', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (clack.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

        const result = await cmd_init('/repo', []);

        expect(result).toBe(0);
        expect(clack.cancel).toHaveBeenCalledWith('Setup aborted.');
        expect(mkdirSync).not.toHaveBeenCalled();
    });

    it('creates directories and config on fresh init', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (clack.text as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce('npm test')
            .mockResolvedValueOnce('tsc --noEmit');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
            status: 0,
            stdout: 'true',
        });

        const result = await cmd_init('/repo', []);

        expect(result).toBe(0);
        expect(mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('.agents'),
            { recursive: true }
        );
        expect(writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('swarm.config.json'),
            expect.stringContaining('npm test'),
            'utf8'
        );
    });

    it('enables git rerere when not already enabled', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (clack.text as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce('npm test')
            .mockResolvedValueOnce('tsc --noEmit');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (spawnSync as ReturnType<typeof vi.fn>)
            .mockReturnValueOnce({ status: 0, stdout: '' }) // rerere check
            .mockReturnValueOnce({ status: 0, stdout: '' }); // rerere enable

        await cmd_init('/repo', []);

        const calls = (spawnSync as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0]).toEqual([
            'git',
            ['config', 'rerere.enabled'],
            { cwd: '/repo', encoding: 'utf8' },
        ]);
        expect(calls[1]).toEqual([
            'git',
            ['config', 'rerere.enabled', 'true'],
            { cwd: '/repo', encoding: 'utf8' },
        ]);
    });

    it('skips git rerere when already enabled', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (clack.text as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce('npm test')
            .mockResolvedValueOnce('tsc --noEmit');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
            status: 0,
            stdout: 'true',
        });

        await cmd_init('/repo', []);

        const calls = (spawnSync as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual([
            'git',
            ['config', 'rerere.enabled'],
            { cwd: '/repo', encoding: 'utf8' },
        ]);
    });

    it('copies scaffold when scaffold directory exists', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
            if (path.includes('scaffold')) return true;
            return false;
        });
        (clack.text as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce('npm test')
            .mockResolvedValueOnce('tsc --noEmit');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
            status: 0,
            stdout: 'true',
        });

        await cmd_init('/repo', []);

        expect(cpSync).toHaveBeenCalledWith(
            expect.stringContaining('scaffold'),
            expect.stringContaining('.agents'),
            { recursive: true, force: false }
        );
    });

    it('aborts when test prompt is cancelled', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (clack.text as ReturnType<typeof vi.fn>).mockResolvedValueOnce('npm test');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
            return value === undefined || value === null;
        });

        const result = await cmd_init('/repo', []);

        expect(result).toBe(0);
        expect(clack.cancel).toHaveBeenCalledWith('Setup aborted.');
    });

    it('writes correct config structure', async () => {
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (clack.text as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce('npm test')
            .mockResolvedValueOnce('tsc --noEmit');
        (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
        (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
            status: 0,
            stdout: 'true',
        });

        await cmd_init('/repo', []);

        const [configPath, configContent] = (
            writeFileSync as ReturnType<typeof vi.fn>
        ).mock.calls[0] as [string, string, string];

        expect(configPath).toContain('swarm.config.json');
        const parsed = JSON.parse(configContent) as {
            commands: Record<string, string>;
            agentRules: string[];
        };
        expect(parsed.commands.install).toBe('npm install');
        expect(parsed.commands.test).toBe('npm test');
        expect(parsed.commands.typecheck).toBe('tsc --noEmit');
        expect(parsed.commands.validateDeps).toBe('npm ls');
        expect(parsed.agentRules).toEqual([
            'Always adhere to project linting rules.',
            'Empirical proof is required before PR.',
        ]);
    });
});
