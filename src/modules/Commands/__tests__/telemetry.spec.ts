import { describe, expect, it } from 'vitest';
import { aggregateMetrics } from '../useCases/telemetry.ts';

describe('aggregateMetrics', () => {
    it('returns zeros for empty state', () => {
        const result = aggregateMetrics({});
        expect(result).toEqual({ activeCount: 0, completedCount: 0, crashedCount: 0 });
    });

    it('counts running agents as active', () => {
        const state = { agent1: { status: 'running' } };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(1);
        expect(result.completedCount).toBe(0);
        expect(result.crashedCount).toBe(0);
    });

    it('counts crashed agents', () => {
        const state = { agent1: { status: 'crashed' } };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(0);
        expect(result.completedCount).toBe(0);
        expect(result.crashedCount).toBe(1);
    });

    it('counts completed agents (any non-running non-crashed status)', () => {
        const state = { agent1: { status: 'completed' }, agent2: { status: 'idle' } };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(0);
        expect(result.completedCount).toBe(2);
        expect(result.crashedCount).toBe(0);
    });

    it('handles mixed statuses', () => {
        const state = {
            agent1: { status: 'running' },
            agent2: { status: 'crashed' },
            agent3: { status: 'completed' },
            agent4: { status: 'running' },
        };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(2);
        expect(result.completedCount).toBe(1);
        expect(result.crashedCount).toBe(1);
    });

    it('ignores non-object entries', () => {
        const state = { agent1: { status: 'running' }, invalid: 'string', nullish: null };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(1);
    });

    it('handles missing status field', () => {
        const state = { agent1: { backend: 'tmux' } };
        const result = aggregateMetrics(state);
        expect(result.activeCount).toBe(0);
        expect(result.completedCount).toBe(1);
        expect(result.crashedCount).toBe(0);
    });
});
