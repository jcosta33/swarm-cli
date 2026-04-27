import { describe, expect, it } from 'vitest';
import { resolve, sep } from 'path';

import { resolve_within } from '../useCases/resolveWithin.ts';
import { assertOk } from '../../../infra/errors/testing/assertOk.ts';
import { assertErr } from '../../../infra/errors/testing/assertErr.ts';

const REPO = '/tmp/swarm-test-repo';

describe('resolve_within', () => {
    it('accepts a simple relative path inside the repo', () => {
        const result = resolve_within(REPO, 'src/index.ts');
        expect(result.ok).toBe(true);
        expect(assertOk(result)).toBe(`${REPO}${sep}src${sep}index.ts`);
    });

    it('accepts the repo root itself', () => {
        const result = resolve_within(REPO, '.');
        expect(result.ok).toBe(true);
        expect(assertOk(result)).toBe(REPO);
    });

    it('accepts a deeply-nested relative path', () => {
        const result = resolve_within(REPO, 'src/modules/Workspace/useCases/resolveWithin.ts');
        expect(result.ok).toBe(true);
    });

    it('accepts an absolute path that resolves inside the repo', () => {
        const result = resolve_within(REPO, `${REPO}/src/index.ts`);
        expect(result.ok).toBe(true);
    });

    it('rejects ../ that escapes the repo', () => {
        const result = resolve_within(REPO, '../../../etc/passwd');
        expect(result.ok).toBe(false);
        const error = assertErr(result);
        expect(error._tag).toBe('PathTraversal');
        expect(error.userPath).toBe('../../../etc/passwd');
        expect(error.resolved).toBe(resolve('/etc/passwd'));
    });

    it('rejects an absolute path pointing outside the repo', () => {
        const result = resolve_within(REPO, '/etc/passwd');
        expect(result.ok).toBe(false);
        expect(assertErr(result)._tag).toBe('PathTraversal');
    });

    it('rejects a sibling-prefix attack (e.g. "/tmp/swarm-test-repo-evil/foo")', () => {
        // The naive `startsWith(repoRoot)` check would accept this; the
        // separator-aware check rejects it.
        const result = resolve_within(REPO, `${REPO}-evil/foo`);
        expect(result.ok).toBe(false);
    });

    it('handles repo paths that already end with a separator', () => {
        const result = resolve_within(`${REPO}/`, 'src/index.ts');
        expect(result.ok).toBe(true);
    });

    it('normalises redundant ./ segments inside the repo', () => {
        const result = resolve_within(REPO, './src/./index.ts');
        expect(result.ok).toBe(true);
        expect(assertOk(result)).toBe(`${REPO}${sep}src${sep}index.ts`);
    });
});
