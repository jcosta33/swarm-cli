import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { claim_lock, release_lock, list_locks } from '../useCases/locks.ts';
import { assertOk } from '../../../infra/errors/testing/assertOk.ts';
import { assertErr } from '../../../infra/errors/testing/assertErr.ts';

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
        expect(result.ok).toBe(true);
        expect(assertOk(result)).toBe(true);
    });

    it('prevents another agent from claiming the same file', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const result = claim_lock(tempDir, 'agent-b', ['src/index.ts']);
        expect(result.ok).toBe(false);
        const error = assertErr(result);
        expect(error._tag).toBe('LockHeldByOther');
        expect(error.heldBy).toBe('agent-a');
        expect(error.file).toBe('src/index.ts');
    });

    it('allows same agent to re-claim its own files', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const result = claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        expect(result.ok).toBe(true);
    });

    it('releases a claimed lock', () => {
        claim_lock(tempDir, 'agent-a', ['src/index.ts']);
        const release = release_lock(tempDir, 'src/index.ts');
        expect(release.ok).toBe(true);

        const locks = list_locks(tempDir);
        expect(locks).toHaveLength(0);
    });

    it('returns a tagged error when releasing non-existent lock', () => {
        const result = release_lock(tempDir, 'src/index.ts');
        expect(result.ok).toBe(false);
        const error = assertErr(result);
        expect(error._tag).toBe('LockNotFound');
        expect(error.file).toBe('src/index.ts');
    });

    it('lists only active non-expired locks', () => {
        claim_lock(tempDir, 'agent-a', ['src/a.ts', 'src/b.ts']);
        const locks = list_locks(tempDir);
        expect(locks).toHaveLength(2);
        expect(locks.map((l) => l.agent_slug)).toEqual(['agent-a', 'agent-a']);
    });
});
