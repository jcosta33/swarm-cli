import { resolve, sep } from 'path';

import { createAppError, type AppError } from '../../../infra/errors/createAppError.ts';
import { err, ok, type Result } from '../../../infra/errors/result.ts';

export type PathTraversalError = AppError<
    'PathTraversal',
    { repoRoot: string; userPath: string; resolved: string }
>;

export type ResolveWithinResult = Result<string, PathTraversalError>;

/**
 * Resolve `userPath` against `repoRoot` and confirm the result stays inside
 * `repoRoot`. Returns `Ok(absolutePath)` for safe inputs, `Err` tagged
 * `PathTraversal` when the resolved path escapes the repo (via `..`,
 * absolute paths pointing elsewhere, or symlink-style indirection at the
 * string level).
 *
 * This guards every CLI command that accepts a file/directory argument
 * from a non-trusted source. It does NOT follow symlinks — callers that
 * need that should chain `realpathSync` and re-validate.
 */
export function resolve_within(repoRoot: string, userPath: string): ResolveWithinResult {
    const absRoot = resolve(repoRoot);
    const absResolved = resolve(absRoot, userPath);

    // `resolved === root` is allowed (operating on the repo itself).
    // `resolved` must otherwise be a strict descendant of `root`.
    if (absResolved === absRoot) {
        return ok(absResolved);
    }
    const rootWithSep = absRoot.endsWith(sep) ? absRoot : absRoot + sep;
    if (absResolved.startsWith(rootWithSep)) {
        return ok(absResolved);
    }

    return err(
        createAppError(
            'PathTraversal',
            `Path "${userPath}" escapes the repository root "${absRoot}".`,
            { repoRoot: absRoot, userPath, resolved: absResolved }
        )
    );
}
