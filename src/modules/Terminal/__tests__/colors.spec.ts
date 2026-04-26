import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { red, green, yellow, blue, cyan, dim, bold, success, info, warn, error, box } from '../useCases/colors.ts';

vi.mock('../services/logger.ts', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), raw: vi.fn() },
}));

import { logger } from '../services/logger.ts';

describe('colors', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.mocked(logger.info).mockClear();
        vi.mocked(logger.warn).mockClear();
        vi.mocked(logger.error).mockClear();
        vi.mocked(logger.raw).mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('red returns string', () => {
        expect(typeof red('hello')).toBe('string');
    });

    it('green returns string', () => {
        expect(typeof green('hello')).toBe('string');
    });

    it('yellow returns string', () => {
        expect(typeof yellow('hello')).toBe('string');
    });

    it('blue returns string', () => {
        expect(typeof blue('hello')).toBe('string');
    });

    it('cyan returns string', () => {
        expect(typeof cyan('hello')).toBe('string');
    });

    it('dim returns string', () => {
        expect(typeof dim('hello')).toBe('string');
    });

    it('bold returns string', () => {
        expect(typeof bold('hello')).toBe('string');
    });

    it('success calls logger.info', () => {
        success('done');
        expect(logger.info).toHaveBeenCalled();
    });

    it('info calls logger.info', () => {
        info('note');
        expect(logger.info).toHaveBeenCalled();
    });

    it('warn calls logger.warn', () => {
        warn('caution');
        expect(logger.warn).toHaveBeenCalled();
    });

    it('error calls logger.error', () => {
        error('fail');
        expect(logger.error).toHaveBeenCalled();
    });

    it('box calls logger.raw', () => {
        box('Title', ['line 1', 'line 2']);
        expect(logger.raw).toHaveBeenCalled();
    });
});
