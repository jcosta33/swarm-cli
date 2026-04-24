import { describe, expect, it } from 'vitest';
import { generateFuzzTemplate } from '../useCases/fuzz.ts';

describe('generateFuzzTemplate', () => {
    it('generates a template with the function name', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain("import { myFunc } from '../utils';");
    });

    it('includes a describe block with the function name', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain("describe('myFunc Fuzzer'");
    });

    it('includes null handling test', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain('handles unexpected nulls');
        expect(template).toContain('myFunc(null as any)');
    });

    it('includes undefined handling test', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain('handles undefined');
        expect(template).toContain('myFunc(undefined as any)');
    });

    it('includes massive payload test', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain('handles massive arrays/strings');
    });

    it('includes cyclic object test', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain('handles cyclic objects');
    });

    it('includes NaN and Infinity test', () => {
        const template = generateFuzzTemplate('myFunc', 'utils');
        expect(template).toContain('handles NaN and Infinity');
    });
});
