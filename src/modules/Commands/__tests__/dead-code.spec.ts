import { describe, expect, it } from 'vitest';
import { extractExports } from '../useCases/dead-code.ts';

describe('extractExports', () => {
    it('returns empty array for code with no exports', () => {
        const code = 'const x = 1;\nfunction foo() {}';
        expect(extractExports(code)).toEqual([]);
    });

    it('extracts exported const', () => {
        const code = 'export const foo = 1;';
        expect(extractExports(code)).toEqual(['foo']);
    });

    it('extracts exported function', () => {
        const code = 'export function bar() {}';
        expect(extractExports(code)).toEqual(['bar']);
    });

    it('extracts exported class', () => {
        const code = 'export class Baz {}';
        expect(extractExports(code)).toEqual(['Baz']);
    });

    it('extracts exported type', () => {
        const code = 'export type MyType = string;';
        expect(extractExports(code)).toEqual(['MyType']);
    });

    it('extracts exported interface', () => {
        const code = 'export interface MyInterface {}';
        expect(extractExports(code)).toEqual(['MyInterface']);
    });

    it('extracts exported let and var', () => {
        const code = 'export let a = 1;\nexport var b = 2;';
        expect(extractExports(code)).toEqual(['a', 'b']);
    });

    it('extracts multiple exports', () => {
        const code = `
            export const x = 1;
            export function y() {}
            export class Z {}
        `;
        expect(extractExports(code)).toEqual(['x', 'y', 'Z']);
    });

    it('does not extract default exports', () => {
        const code = 'export default function foo() {}';
        expect(extractExports(code)).toEqual([]);
    });
});
