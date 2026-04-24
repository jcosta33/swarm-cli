import { get_adapter, adapter_capabilities } from '../../Adapters/index.ts';

import { describe, expect, it } from 'vitest';

describe('adapters module', () => {
    it('exports 6 adapter capabilities', () => {
        expect(adapter_capabilities).toHaveLength(6);
        const names = adapter_capabilities.map((c) => c.name);
        expect(names).toContain('claude');
        expect(names).toContain('codex');
        expect(names).toContain('droid');
        expect(names).toContain('gemini');
        expect(names).toContain('kimi');
        expect(names).toContain('opencode');
    });

    it('each capability has required fields', () => {
        for (const cap of adapter_capabilities) {
            expect(cap.name).toBeTypeOf('string');
            expect(cap.version).toBeTypeOf('string');
            expect(cap.type).toBe('adapter');
            expect(cap.description).toBeTypeOf('string');
            expect(cap.entry_point).toBeTypeOf('string');
        }
    });

    it('resolves known adapters by name', () => {
        const claude = get_adapter('claude');
        expect(claude).toBeDefined();
        expect(claude?.command).toBe('claude');
        expect(typeof claude?.build_args).toBe('function');

        const codex = get_adapter('codex');
        expect(codex).toBeDefined();
        expect(codex?.command).toBe('codex');
    });

    it('returns undefined for unknown adapters', () => {
        expect(get_adapter('nonexistent')).toBeUndefined();
        expect(get_adapter('')).toBeUndefined();
    });

    it('build_args returns array for each adapter', () => {
        for (const cap of adapter_capabilities) {
            const adapter = get_adapter(cap.name);
            expect(adapter).toBeDefined();
            if (adapter) {
                const args = adapter.build_args('test-slug');
                expect(Array.isArray(args)).toBe(true);
            }
        }
    });
});
