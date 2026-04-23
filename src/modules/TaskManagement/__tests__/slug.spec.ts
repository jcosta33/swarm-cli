
import { to_slug } from '../../TaskManagement/index.ts';

import { describe, expect, it } from 'vitest';

describe('slug utility', () => {
    it('converts strings to valid agent worktree slugs', () => {
        expect(to_slug('Hello World!')).toBe('hello-world');
        expect(to_slug('Fix: bug in the parser')).toBe('fix-bug-in-the-parser');
        expect(to_slug('  trim   spaces  ')).toBe('trim-spaces');
    });
});