import { parse_args, load_config } from '../../Terminal/index.ts';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('terminal module', () => {
    describe('parse_args', () => {
        it('parses positional arguments', () => {
            const result = parse_args(['new', 'my-task', 'Task Title']);
            expect(result.positional).toEqual(['new', 'my-task', 'Task Title']);
            expect(result.flags.size).toBe(0);
        });

        it('parses long flags with values', () => {
            const result = parse_args(['--agent', 'claude', '--type', 'feature']);
            expect(result.flags.get('agent')).toBe('claude');
            expect(result.flags.get('type')).toBe('feature');
        });

        it('parses long flags with equals syntax', () => {
            const result = parse_args(['--agent=gemini', '--type=fix']);
            expect(result.flags.get('agent')).toBe('gemini');
            expect(result.flags.get('type')).toBe('fix');
        });

        it('parses boolean long flags', () => {
            const result = parse_args(['--verbose', '--dry-run']);
            expect(result.flags.get('verbose')).toBe(true);
            expect(result.flags.get('dry-run')).toBe(true);
        });

        it('parses short flags with values', () => {
            const result = parse_args(['-a', 'claude', '-t', 'refactor']);
            expect(result.flags.get('a')).toBe('claude');
            expect(result.flags.get('t')).toBe('refactor');
        });

        it('parses short boolean flags', () => {
            const result = parse_args(['-v', '-d']);
            expect(result.flags.get('v')).toBe(true);
            expect(result.flags.get('d')).toBe(true);
        });

        it('stops flag parsing after -- separator', () => {
            const result = parse_args(['--agent', 'claude', '--', '--type', 'feature']);
            expect(result.flags.get('agent')).toBe('claude');
            expect(result.positional).toEqual(['--type', 'feature']);
        });

        it('handles mixed positional and flags', () => {
            const result = parse_args(['new', 'my-task', '--agent', 'claude', 'Extra Title']);
            expect(result.positional).toEqual(['new', 'my-task', 'Extra Title']);
            expect(result.flags.get('agent')).toBe('claude');
        });
    });

    describe('load_config', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = mkdtempSync(join(tmpdir(), 'swarm-config-test-'));
        });

        afterEach(() => {
            rmSync(tempDir, { recursive: true, force: true });
        });

        it('returns defaults when no config file exists', () => {
            const config = load_config(tempDir);
            expect(config.defaultBaseBranch).toBe('main');
            expect(config.defaultAgent).toBe('claude');
            expect(config.worktreeDirPattern).toBe('../{repoName}--{slug}');
            expect(config.commands).toEqual({
                install: 'pnpm i',
                typecheck: 'pnpm typecheck',
                validateDeps: 'pnpm deps:validate',
                test: 'pnpm test',
            });
        });

        it('reads swarm.config.json and merges with defaults', () => {
            const configPath = join(tempDir, 'swarm.config.json');
            writeFileSync(configPath, JSON.stringify({
                defaultAgent: 'gemini',
                slugMaxLen: 30,
            }), 'utf8');

            const config = load_config(tempDir);
            expect(config.defaultAgent).toBe('gemini');
            expect(config.slugMaxLen).toBe(30);
            expect(config.defaultBaseBranch).toBe('main'); // default preserved
        });

        it('falls back to legacy config path when present', () => {
            const legacyDir = join(tempDir, 'scripts', 'agents');
            mkdirSync(legacyDir, { recursive: true });
            const legacyPath = join(legacyDir, 'config.json');
            writeFileSync(legacyPath, JSON.stringify({
                defaultAgent: 'codex',
            }), 'utf8');

            const config = load_config(tempDir);
            expect(config.defaultAgent).toBe('codex');
        });

        it('returns defaults when config file is malformed', () => {
            const configPath = join(tempDir, 'swarm.config.json');
            writeFileSync(configPath, 'not valid json', 'utf8');

            const config = load_config(tempDir);
            expect(config.defaultBaseBranch).toBe('main');
            expect(config.defaultAgent).toBe('claude');
        });

        it('merges agent configs deeply', () => {
            const configPath = join(tempDir, 'swarm.config.json');
            writeFileSync(configPath, JSON.stringify({
                agents: {
                    kimi: { command: 'kimi', args: ['--verbose'] },
                },
            }), 'utf8');

            const config = load_config(tempDir);
            expect(config.agents?.claude).toEqual({ command: 'claude', args: [] }); // default preserved
            expect(config.agents?.kimi).toEqual({ command: 'kimi', args: ['--verbose'] });
        });
    });
});
