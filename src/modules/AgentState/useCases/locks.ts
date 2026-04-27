import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { lockSync, unlockSync } from 'proper-lockfile';

import { createAppError, type AppError } from '../../../infra/errors/createAppError.ts';
import { err, ok, type Result } from '../../../infra/errors/result.ts';

type FileLock = {
    agent_slug: string;
    files: string[];
    claimed_at: string;
    expires_at: string;
};

export type LockHeldByOtherError = AppError<
    'LockHeldByOther',
    { file: string; heldBy: string; expiresAt: string }
>;

export type LockNotFoundError = AppError<'LockNotFound', { file: string }>;

export type ClaimLockResult = Result<true, LockHeldByOtherError>;
export type ReleaseLockResult = Result<true, LockNotFoundError>;

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCK_OPTS = { stale: 5000 };

function ensure_locks_file(path: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(path)) {
        writeFileSync(path, '{}', 'utf8');
    }
}

function with_locks_mutex<T>(repoRoot: string, fn: () => T): T {
    const path = get_locks_path(repoRoot);
    ensure_locks_file(path);
    lockSync(path, LOCK_OPTS);
    try {
        return fn();
    } finally {
        unlockSync(path);
    }
}

function is_file_lock(value: unknown): value is FileLock {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.agent_slug === 'string' &&
        Array.isArray(obj.files) &&
        obj.files.every((f: unknown) => typeof f === 'string') &&
        typeof obj.claimed_at === 'string' &&
        typeof obj.expires_at === 'string'
    );
}

function is_locks_record(value: unknown): value is Partial<Record<string, FileLock>> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const obj = value as Record<string, unknown>;
    return Object.values(obj).every((v) => v === undefined || is_file_lock(v));
}

function get_locks_path(repoRoot: string): string {
    return join(repoRoot, '.agents', 'locks.json');
}

function read_locks(repoRoot: string): Partial<Record<string, FileLock>> {
    const path = get_locks_path(repoRoot);
    if (!existsSync(path)) {
        return {};
    }
    try {
        const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
        if (is_locks_record(raw)) {
            return raw;
        }
        return {};
    } catch {
        return {};
    }
}

function write_locks(repoRoot: string, locks: Partial<Record<string, FileLock>>): void {
    const path = get_locks_path(repoRoot);
    writeFileSync(path, JSON.stringify(locks, null, 2), 'utf8');
}

function is_expired(lock: FileLock): boolean {
    return new Date(lock.expires_at).getTime() < Date.now();
}

export function claim_lock(repoRoot: string, agentSlug: string, files: string[]): ClaimLockResult {
    return with_locks_mutex(repoRoot, (): ClaimLockResult => {
        const locks = read_locks(repoRoot);

        for (const file of files) {
            const existing = locks[file];
            if (existing !== undefined && !is_expired(existing) && existing.agent_slug !== agentSlug) {
                return err(
                    createAppError(
                        'LockHeldByOther',
                        `File "${file}" is already claimed by ${existing.agent_slug} (expires: ${existing.expires_at}).`,
                        { file, heldBy: existing.agent_slug, expiresAt: existing.expires_at }
                    )
                );
            }
        }

        const now = Date.now();
        const expiresAt = new Date(now + DEFAULT_TTL_MS).toISOString();

        for (const file of files) {
            locks[file] = {
                agent_slug: agentSlug,
                files: [file],
                claimed_at: new Date(now).toISOString(),
                expires_at: expiresAt,
            };
        }

        write_locks(repoRoot, locks);
        return ok(true);
    });
}

export function release_lock(repoRoot: string, file: string): ReleaseLockResult {
    return with_locks_mutex(repoRoot, (): ReleaseLockResult => {
        const locks = read_locks(repoRoot);
        const existing = locks[file];
        if (existing === undefined) {
            return err(createAppError('LockNotFound', `File "${file}" is not locked.`, { file }));
        }

        const { [file]: _removed, ...rest } = locks;
        void _removed;
        write_locks(repoRoot, rest);
        return ok(true);
    });
}

export function list_locks(repoRoot: string): FileLock[] {
    return with_locks_mutex(repoRoot, () => {
        const locks = read_locks(repoRoot);
        return Object.values(locks).filter((lock): lock is FileLock => lock !== undefined && !is_expired(lock));
    });
}
