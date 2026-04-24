import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { claim_lock, release_lock, list_locks } from '../useCases/locks.ts';

describe('locks module', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'swarm-locks-test-'));
        mkdirSync(join(tempDir, '.agents'), { recursive: true });
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('claims a lock successfully', () => {
        const result = claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        expect(result.success).toBe(true);
    });

    it('prevents another agent from claiming the same file', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const result = claim_lock(tempDir, 'agent-b', ['src/index.ts']);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('agent-a');
    });

    it('allows same agent to re-claim its own files', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const result = claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        expect(result.success).toBe(true);
    });

    it('releases a claimed lock', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const release = release_lock(tempDir, 'src/index.ts');
        expect(release.success).toBe(true);

        const locks = list_locks(tempDir);
        expect(locks).toHaveLength(0);
    });

    it('returns error when releasing non-existent lock', () => {
        const result = release_lock(tempDir, 'src/index.ts');
        expect(result.success).toBe(false);
        expect(result.reason).toContain('not locked');
    });

    it('lists only active non-expired locks', () => {
        claim_lock(tempDir, 'agent-a', ['src/a.ts', 'src/b.ts']);
        const locks = list_locks(tempDir);
        expect(locks).toHaveLength(2);
        expect(locks.map((l) => l.agent_slug)).toEqual(['agent-a', 'agent-a']);
    });
});
