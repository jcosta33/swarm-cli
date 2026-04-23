
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { lockSync, unlockSync } from 'proper-lockfile';

interface AgentState {
    status?: string;
    pid?: number;
    backend?: string;
    agent?: string;
    lastUpdated?: string;
    exitCode?: number | null;
    error?: string | null;
}

function is_agent_state(value: unknown): value is AgentState {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    const validKeys = ['status', 'pid', 'backend', 'agent', 'lastUpdated', 'exitCode', 'error'];
    return Object.keys(obj).every((key) => validKeys.includes(key));
}

function validate_state(data: unknown): Record<string, AgentState> {
    if (typeof data !== 'object' || data === null) {
        return {};
    }
    const result: Record<string, AgentState> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (is_agent_state(value)) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Returns the path to the state file. Creates `.agents` dir if missing.
 */
function get_state_file_path(repoRoot: string) {
    const agentsDir = join(repoRoot, '.agents');
    if (!existsSync(agentsDir)) {
        mkdirSync(agentsDir, { recursive: true });
    }
    return join(agentsDir, 'state.json');
}

/**
 * Read the entire state registry.
 */
export function read_state(repoRoot: string): Record<string, AgentState | undefined> {
    const statePath = get_state_file_path(repoRoot);
    if (!existsSync(statePath)) {
        return {};
    }
    lockSync(statePath, { stale: 5000 });
    try {
        const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as unknown;
        return validate_state(parsed);
    } catch (_e: unknown) {
        const e = _e instanceof Error ? _e : new Error(String(_e));
        console.warn(`Warning: could not read state.json: ${e.message}`);
        return {};
    } finally {
        unlockSync(statePath);
    }
}

/**
 * Atomically update the state for a specific agent slug.
 * Writes to a temp file and renames to avoid corruption from concurrent writes.
 */
export function write_state(repoRoot: string, slug: string, data: AgentState) {
    const statePath = get_state_file_path(repoRoot);
    lockSync(statePath, { stale: 5000 });
    try {
        const currentState = read_state(repoRoot);
        currentState[slug] = {
            ...(currentState[slug] ?? {}),
            ...data,
            lastUpdated: new Date().toISOString(),
        };
        const tempPath = `${statePath}.tmp`;
        writeFileSync(tempPath, JSON.stringify(currentState, null, 2), 'utf8');
        renameSync(tempPath, statePath);
    } finally {
        unlockSync(statePath);
    }
}

/**
 * Remove an agent from the state registry.
 */
export function remove_state(repoRoot: string, slug: string) {
    const statePath = get_state_file_path(repoRoot);
    lockSync(statePath, { stale: 5000 });
    try {
        const currentState = read_state(repoRoot);
        if (currentState[slug] !== undefined) {
            const { [slug]: _removed, ...rest } = currentState;
            void _removed;
            const tempPath = `${statePath}.tmp`;
            writeFileSync(tempPath, JSON.stringify(rest, null, 2), 'utf8');
            renameSync(tempPath, statePath);
        }
    } finally {
        unlockSync(statePath);
    }
}

/**
 * Check if a PID is currently running.
 */
export function is_process_running(pid: number | null | undefined) {
    if (!pid) {
        return false;
    }
    try {
        // kill(pid, 0) checks for existence without sending a signal
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
