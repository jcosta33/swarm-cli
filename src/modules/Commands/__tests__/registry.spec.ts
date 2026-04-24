import { describe, expect, it, beforeEach } from 'vitest';
import {
    register_capability,
    get_capability,
    find_capabilities,
    list_capabilities,
} from '../services/registry.ts';

describe('capability registry', () => {
    beforeEach(() => {
        // Registry is module-level state; tests must use unique names
    });

    it('registers and retrieves a capability', () => {
        const cap = {
            name: 'test-cmd-1',
            version: '1.0.0',
            type: 'command' as const,
            description: 'A test command',
            entry_point: './useCases/test.ts',
        };
        register_capability(cap);
        const found = get_capability('test-cmd-1');
        expect(found).toEqual(cap);
    });

    it('throws on duplicate registration', () => {
        const cap = {
            name: 'test-cmd-dup',
            version: '1.0.0',
            type: 'command' as const,
            description: 'Dup',
            entry_point: './dup.ts',
        };
        register_capability(cap);
        expect(() => { register_capability(cap); }).toThrow('already registered');
    });

    it('returns undefined for unknown capabilities', () => {
        expect(get_capability('nonexistent-cmd')).toBeUndefined();
    });

    it('lists all registered capabilities', () => {
        const before = list_capabilities().length;
        register_capability({
            name: 'list-test-a',
            version: '1.0.0',
            type: 'command' as const,
            description: 'A',
            entry_point: './a.ts',
        });
        register_capability({
            name: 'list-test-b',
            version: '2.0.0',
            type: 'adapter' as const,
            description: 'B',
            entry_point: './b.ts',
        });
        const all = list_capabilities();
        expect(all.length).toBe(before + 2);
        expect(all.map((c) => c.name)).toContain('list-test-a');
        expect(all.map((c) => c.name)).toContain('list-test-b');
    });

    it('finds capabilities by filter', () => {
        register_capability({
            name: 'find-test-cmd',
            version: '1.0.0',
            type: 'command' as const,
            description: 'A command',
            entry_point: './cmd.ts',
        });
        register_capability({
            name: 'find-test-adapt',
            version: '1.0.0',
            type: 'adapter' as const,
            description: 'An adapter',
            entry_point: './adapt.ts',
        });

        const commands = find_capabilities({ type: 'command' });
        expect(commands.length).toBeGreaterThanOrEqual(1);
        expect(commands.every((c) => c.type === 'command')).toBe(true);

        const specific = find_capabilities({ name: 'find-test-adapt' });
        expect(specific).toHaveLength(1);
        expect(specific[0]?.name).toBe('find-test-adapt');
    });
});
