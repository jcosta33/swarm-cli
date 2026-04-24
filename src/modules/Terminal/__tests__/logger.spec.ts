import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { logger, run_with_context, get_log_context } from '../services/logger.ts';

describe('logger module', () => {
    let consoleLogSpy: MockInstance<typeof console.log>;
    let consoleErrorSpy: MockInstance<typeof console.error>;
    let stdoutSpy: MockInstance<typeof process.stdout.write>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        delete process.env.SWARM_LOG_FORMAT;
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        stdoutSpy.mockRestore();
        delete process.env.SWARM_LOG_FORMAT;
    });

    it('logs info messages to console.log in plain mode', () => {
        logger.info('hello world');
        expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs error messages to console.error in plain mode', () => {
        logger.error('something went wrong');
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('outputs NDJSON when SWARM_LOG_FORMAT=json', () => {
        process.env.SWARM_LOG_FORMAT = 'json';
        logger.info('test message');
        const calls = stdoutSpy.mock.calls;
        const lastCall = calls[calls.length - 1]?.[0] as string;
        const parsed: Record<string, unknown> = JSON.parse(lastCall.trim()) as Record<string, unknown>;
        expect(parsed.level).toBe('info');
        expect(parsed.msg).toBe('test message');
        expect(typeof parsed.timestamp).toBe('string');
    });

    it('includes context in NDJSON output', () => {
        process.env.SWARM_LOG_FORMAT = 'json';
        run_with_context({ trace_id: 'abc123', slug: 'my-task' }, () => {
            logger.info('contextual message');
        });
        const calls = stdoutSpy.mock.calls;
        const lastCall = calls[calls.length - 1]?.[0] as string;
        const parsed: Record<string, unknown> = JSON.parse(lastCall.trim()) as Record<string, unknown>;
        expect(parsed.trace_id).toBe('abc123');
        expect(parsed.slug).toBe('my-task');
    });

    it('get_log_context returns undefined outside of run_with_context', () => {
        expect(get_log_context()).toBeUndefined();
    });

    it('get_log_context returns context inside run_with_context', () => {
        run_with_context({ trace_id: 'xyz' }, () => {
            expect(get_log_context()).toEqual({ trace_id: 'xyz' });
        });
    });

    it('logger.raw bypasses NDJSON formatting', () => {
        process.env.SWARM_LOG_FORMAT = 'json';
        logger.raw('plain text line');
        const calls = stdoutSpy.mock.calls;
        const lastCall = calls[calls.length - 1]?.[0] as string;
        expect(lastCall.trim()).toBe('plain text line');
        expect(() => { void JSON.parse(lastCall.trim()); }).toThrow();
    });

    it('logger.debug only outputs when SWARM_DEBUG is set', () => {
        logger.debug('hidden debug');
        const beforeCount = consoleLogSpy.mock.calls.length;

        process.env.SWARM_DEBUG = '1';
        logger.debug('visible debug');
        const afterCount = consoleLogSpy.mock.calls.length;

        expect(afterCount).toBeGreaterThan(beforeCount);
    });
});
