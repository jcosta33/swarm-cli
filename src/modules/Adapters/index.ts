
import * as claude from './useCases/claude.ts';
import * as codex from './useCases/codex.ts';
import * as droid from './useCases/droid.ts';
import * as gemini from './useCases/gemini.ts';
import * as kimi from './useCases/kimi.ts';
import * as opencode from './useCases/opencode.ts';

const adapters: Record<string, { command: string; build_args: (slug: string, extraArgs?: string[], options?: Record<string, unknown>) => string[] }> = {
    claude,
    codex,
    droid,
    gemini,
    kimi,
    opencode,
};

/**
 * Resolve an agent adapter by name.
 * @param {string} name
 * @returns {object | undefined}
 */
export function get_adapter(name: string): (typeof adapters)[string] | undefined {
    return adapters[name];
}
