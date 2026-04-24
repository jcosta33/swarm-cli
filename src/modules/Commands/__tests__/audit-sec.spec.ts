import { describe, expect, it } from 'vitest';
import { auditSecurity } from '../useCases/audit-sec.ts';

describe('auditSecurity', () => {
    it('returns empty array for safe code', () => {
        const code = 'const x = 1;\nfunction foo() { return 42; }';
        expect(auditSecurity(code)).toEqual([]);
    });

    it('detects eval usage', () => {
        const code = "eval('dangerous');";
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            line: 1,
            text: "eval('dangerous');",
            description: 'Usage of eval() is highly dangerous.',
        });
    });

    it('detects dangerouslySetInnerHTML', () => {
        const code = '<div dangerouslySetInnerHTML={{ __html: html }} />';
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0].description).toBe('React dangerouslySetInnerHTML found. XSS risk.');
    });

    it('detects localStorage token storage', () => {
        const code = "localStorage.setItem('token', 'secret');";
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0].description).toBe('Storing auth tokens in localStorage exposes them to XSS.');
    });

    it('detects hardcoded API_KEY', () => {
        const code = 'const API_KEY = "sk-12345";';
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0].description).toBe('Potential hardcoded API_KEY detected.');
    });

    it('detects hardcoded SECRET', () => {
        const code = 'const SECRET = "my-secret";';
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0].description).toBe('Potential hardcoded SECRET detected.');
    });

    it('reports correct line numbers', () => {
        const code = 'const a = 1;\neval("bad");\nconst b = 2;';
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(1);
        expect(issues[0].line).toBe(2);
    });

    it('detects multiple issues in one file', () => {
        const code = `
            eval('x');
            const API_KEY = 'key';
            const SECRET = 'secret';
        `;
        const issues = auditSecurity(code);
        expect(issues).toHaveLength(3);
    });
});
