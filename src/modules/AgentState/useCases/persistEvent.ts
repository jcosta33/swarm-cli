import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

export type PersistedEvent = {
    timestamp: string;
    event: string;
    payload: Record<string, unknown>;
};

function get_event_log_path(repoRoot: string): string {
    const logsDir = join(repoRoot, '.agents', 'logs');
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
    }
    return join(logsDir, 'events.ndjson');
}

/**
 * Append one NDJSON line to `.agents/logs/events.ndjson`. Used as the
 * canonical sink for every event emitted on `swarmBus` — gives operators
 * a tail-able audit log without needing a SQLite client.
 *
 * Designed to never throw: if disk I/O fails (read-only mount, full disk),
 * we silently drop the line rather than crashing the CLI command that
 * triggered the event. The caller is a fire-and-forget bus listener.
 */
export function persist_event(repoRoot: string, eventName: string, payload: Record<string, unknown>): void {
    try {
        const path = get_event_log_path(repoRoot);
        const entry: PersistedEvent = {
            timestamp: new Date().toISOString(),
            event: eventName,
            payload,
        };
        appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
        // Best-effort sink. Never propagate.
    }
}

/**
 * Read the most recent `limit` events from the NDJSON log. Tolerates
 * partial writes (skips malformed lines).
 */
export function read_events(repoRoot: string, limit = 50): PersistedEvent[] {
    const path = get_event_log_path(repoRoot);
    if (!existsSync(path)) {
        return [];
    }
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const slice = limit > 0 && lines.length > limit ? lines.slice(-limit) : lines;
    const result: PersistedEvent[] = [];
    for (const line of slice) {
        try {
            const parsed: unknown = JSON.parse(line);
            if (
                parsed &&
                typeof parsed === 'object' &&
                'timestamp' in parsed &&
                'event' in parsed &&
                'payload' in parsed
            ) {
                result.push(parsed as PersistedEvent);
            }
        } catch {
            // Skip malformed lines (e.g. truncated final write).
        }
    }
    return result;
}
