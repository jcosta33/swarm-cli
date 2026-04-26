import { describe, expect, it } from 'vitest';
import { render_template, build_metadata_block, create_or_update_task_file } from '../useCases/template.ts';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, tmpdir } from 'path';

describe('template', () => {
    describe('render_template', () => {
        it('replaces placeholders with data', () => {
            const template = '# {{title}}\nSlug: {{slug}}';
            const result = render_template(template, { title: 'My Task', slug: 'my-task' });
            expect(result).toBe('# My Task\nSlug: my-task');
        });

        it('uses defaults for missing data', () => {
            const template = 'Status: {{status}}';
            const result = render_template(template, {});
            expect(result).toBe('Status: active');
        });

        it('parses commands JSON', () => {
            const template = 'Install: {{cmdInstall}}';
            const result = render_template(template, { commands: JSON.stringify({ install: 'pnpm i' }) });
            expect(result).toBe('Install: pnpm i');
        });
    });

    describe('build_metadata_block', () => {
        it('builds metadata block', () => {
            const result = build_metadata_block({ slug: 'test', agent: 'claude', branch: 'agent/test', baseBranch: 'main', worktreePath: '/tmp', createdAt: '2024-01-01' });
            expect(result).toContain('Slug: test');
            expect(result).toContain('Agent: claude');
        });

        it('includes optional fields', () => {
            const result = build_metadata_block({ slug: 'test', agent: 'claude', branch: 'agent/test', baseBranch: 'main', worktreePath: '/tmp', createdAt: '2024-01-01', parent: 'epic-1', type: 'feature', specFile: 'spec.md' });
            expect(result).toContain('Parent: epic-1');
            expect(result).toContain('Type: feature');
            expect(result).toContain('Spec: spec.md');
        });
    });

    describe('create_or_update_task_file', () => {
        it('creates new task file from template', () => {
            const tmpDir = mkdtempSync(join(tmpdir(), 'swarm-test-'));
            const taskFile = join(tmpDir, 'task.md');
            const templateDir = join(tmpDir, 'templates');
            writeFileSync(join(templateDir, 'task.md'), '# {{title}}', 'utf8');

            create_or_update_task_file(taskFile, templateDir, { title: 'Test', slug: 'test', agent: 'claude', branch: 'agent/test', baseBranch: 'main', worktreePath: '/tmp', createdAt: '2024-01-01' });
            expect(readFileSync(taskFile, 'utf8')).toContain('# Test');
            rmSync(tmpDir, { recursive: true });
        });

        it('updates existing file metadata', () => {
            const tmpDir = mkdtempSync(join(tmpdir(), 'swarm-test-'));
            const taskFile = join(tmpDir, 'task.md');
            writeFileSync(taskFile, '# Task\n## Metadata\n- Slug: old\n\n## Objective\nDo it', 'utf8');

            create_or_update_task_file(taskFile, join(tmpDir, 'templates'), { title: 'Test', slug: 'new', agent: 'claude', branch: 'agent/test', baseBranch: 'main', worktreePath: '/tmp', createdAt: '2024-01-01' });
            expect(readFileSync(taskFile, 'utf8')).toContain('Slug: new');
            rmSync(tmpDir, { recursive: true });
        });
    });
});
