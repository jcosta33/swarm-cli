import { describe, expect, it } from 'vitest';
import { generateMockFactory } from '../useCases/mock.ts';

describe('generateMockFactory', () => {
    it('returns generic template when interface not found', () => {
        const code = 'const x = 1;';
        const result = generateMockFactory(code, 'NotFound', 'file');
        expect(result).toContain('createMockNotFound');
        expect(result).toContain('TODO: Fill in default realistic mock values');
    });

    it('generates factory for string properties', () => {
        const code = 'interface User { name: string; email: string; }';
        const result = generateMockFactory(code, 'User', 'user');
        expect(result).toContain("name: 'mock_name',");
        expect(result).toContain("email: 'mock_email',");
    });

    it('generates factory for number properties', () => {
        const code = 'interface Config { timeout: number; retries: number; }';
        const result = generateMockFactory(code, 'Config', 'config');
        expect(result).toContain('timeout: 0,');
        expect(result).toContain('retries: 0,');
    });

    it('generates factory for boolean properties', () => {
        const code = 'interface Flags { enabled: boolean; }';
        const result = generateMockFactory(code, 'Flags', 'flags');
        expect(result).toContain('enabled: false,');
    });

    it('generates factory for function properties', () => {
        const code = 'interface Handler { onClick: () => void; }';
        const result = generateMockFactory(code, 'Handler', 'handler');
        expect(result).toContain('onClick: vi.fn(),');
    });

    it('generates factory for array properties', () => {
        const code = 'interface List { items: string[]; }';
        const result = generateMockFactory(code, 'List', 'list');
        expect(result).toContain('items: [],');
    });

    it('handles optional properties', () => {
        const code = 'interface Opt { name?: string; }';
        const result = generateMockFactory(code, 'Opt', 'opt');
        expect(result).toContain("name: 'mock_name',");
    });

    it('includes the correct import path', () => {
        const code = 'interface User { name: string; }';
        const result = generateMockFactory(code, 'User', 'user-model');
        expect(result).toContain("from './user-model'");
    });

    it('ignores comments inside interface body', () => {
        const code = `interface User {
            // name comment
            name: string;
            /* age comment */
            age: number;
        }`;
        const result = generateMockFactory(code, 'User', 'user');
        expect(result).toContain("name: 'mock_name',");
        expect(result).toContain('age: 0,');
    });
});
