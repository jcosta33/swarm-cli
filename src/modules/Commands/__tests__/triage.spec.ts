import { describe, expect, it } from 'vitest';
import { generateBugSpec } from '../useCases/triage.ts';

describe('generateBugSpec', () => {
    it('includes the slug in the title', () => {
        const spec = generateBugSpec('App crashes on login', 'login-crash');
        expect(spec).toContain('# Bug: login-crash');
    });

    it('includes the raw report content', () => {
        const report = 'Steps to reproduce:\n1. Open app\n2. Click login';
        const spec = generateBugSpec(report, 'bug-1');
        expect(spec).toContain(report);
    });

    it('includes reproduction steps placeholder', () => {
        const spec = generateBugSpec('report', 'bug');
        expect(spec).toContain('## Reproduction Steps');
        expect(spec).toContain('[Agent to fill this out]');
    });

    it('includes acceptance criteria placeholder', () => {
        const spec = generateBugSpec('report', 'bug');
        expect(spec).toContain('## Acceptance Criteria');
        expect(spec).toContain('[Agent to define criteria]');
    });

    it('includes technical constraints', () => {
        const spec = generateBugSpec('report', 'bug');
        expect(spec).toContain('## Technical Constraints');
        expect(spec).toContain('Must include a new test case validating the fix.');
    });
});
