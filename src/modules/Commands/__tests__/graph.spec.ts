import { describe, expect, it } from 'vitest';
import { extractImports } from '../useCases/graph.ts';

describe('extractImports', () => {
    it('returns empty array for code with no imports', () => {
        const code = 'const x = 1;\nfunction foo() {}';
        expect(extractImports(code)).toEqual([]);
    });

    it('extracts named imports', () => {
        const code = "import { foo, bar } from './module';";
        expect(extractImports(code)).toEqual(['./module']);
    });

    it('extracts default imports', () => {
        const code = "import React from 'react';";
        expect(extractImports(code)).toEqual(['react']);
    });

    it('extracts namespace imports', () => {
        const code = "import * as Utils from './utils';";
        expect(extractImports(code)).toEqual(['./utils']);
    });

    it('extracts bare imports', () => {
        const code = "import './styles.css';";
        expect(extractImports(code)).toEqual(['./styles.css']);
    });

    it('deduplicates repeated imports', () => {
        const code = `
            import { a } from './module';
            import { b } from './module';
        `;
        expect(extractImports(code)).toEqual(['./module']);
    });

    it('extracts multiple different imports', () => {
        const code = `
            import React from 'react';
            import { foo } from './foo';
            import { bar } from './bar';
        `;
        expect(extractImports(code)).toEqual(['react', './foo', './bar']);
    });

    it('ignores dynamic imports', () => {
        const code = "const mod = await import('./dynamic');";
        expect(extractImports(code)).toEqual([]);
    });
});
