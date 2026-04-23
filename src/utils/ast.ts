

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Very basic structural rename (mocking an AST tool for this PoC phase).
 * Replaces exact whole-word occurrences in the file.
 */
export function rename_symbol(repoRoot: string, filePath: string, oldName: string, newName: string) {
    const fullPath = join(repoRoot, filePath);
    try {
        let content = readFileSync(fullPath, 'utf8');

        // Exact word boundary replacement to emulate safe AST rename
        const regex = new RegExp(`\\b${oldName}\\b`, 'g');

        if (!regex.test(content)) {
            return { success: false, error: `Symbol '${oldName}' not found in ${filePath}` };
        }

        content = content.replace(regex, newName);
        writeFileSync(fullPath, content, 'utf8');

        return { success: true };
    } catch (_e: unknown) {
        const e = _e instanceof Error ? _e : new Error(String(_e));
        return { success: false, error: e.message };
    }
}
