import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        spawnSync: vi.fn(),
    };
});

import { spawnSync } from 'child_process';
import { split_command, find_markdown_files, command_exists } from '../useCases/cli.ts';

describe('cli utilities', () => {
    describe('split_command', () => {
        it('splits a simple command into program and args', () => {
            const result = split_command('pnpm typecheck');
            expect(result.program).toBe('pnpm');
            expect(result.args).toEqual(['typecheck']);
        });

        it('handles multiple arguments', () => {
            const result = split_command('git log --oneline -n 5');
            expect(result.program).toBe('git');
            expect(result.args).toEqual(['log', '--oneline', '-n', '5']);
        });

        it('trims leading and trailing whitespace', () => {
            const result = split_command('  echo hello  ');
            expect(result.program).toBe('echo');
            expect(result.args).toEqual(['hello']);
        });

        it('throws on empty command string', () => {
            expect(() => split_command('')).toThrow('Empty command string');
            expect(() => split_command('   ')).toThrow('Empty command string');
        });
    });

    describe('find_markdown_files', () => {
        let tempDir: string;

        function setup() {
            tempDir = mkdtempSync(join(tmpdir(), 'swarm-md-test-'));
        }

        function teardown() {
            rmSync(tempDir, { recursive: true, force: true });
        }

        it('finds markdown files recursively', () => {
            setup();
            mkdirSync(join(tempDir, 'sub'), { recursive: true });
            writeFileSync(join(tempDir, 'a.md'), '# A', 'utf8');
            writeFileSync(join(tempDir, 'b.txt'), 'B', 'utf8');
            writeFileSync(join(tempDir, 'sub', 'c.md'), '# C', 'utf8');

            const results = find_markdown_files(tempDir);
            expect(results.sort()).toEqual([
                join(tempDir, 'a.md'),
                join(tempDir, 'sub', 'c.md'),
            ]);
            teardown();
        });

        it('returns empty array for non-existent directory', () => {
            const results = find_markdown_files('/nonexistent/path/12345');
            expect(results).toEqual([]);
        });
    });

    describe('command_exists', () => {
        it('returns true when which/where finds the command', () => {
            (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({ status: 0 });
            expect(command_exists('git')).toBe(true);
        });

        it('returns false when command is not found', () => {
            (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({ status: 1 });
            expect(command_exists('not-a-real-command')).toBe(false);
        });
    });
});
