import { describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
    intro: vi.fn(),
    outro: vi.fn(),
    log: { message: vi.fn() },
}));

import { print_help } from '../useCases/help.ts';

describe('print_help', () => {
    it('runs without error', () => {
        expect(() => print_help()).not.toThrow();
    });
});
