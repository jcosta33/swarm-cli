
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

export const adapter_capabilities = [
    { name: 'claude', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the Claude CLI', entry_point: './useCases/claude.ts' },
    { name: 'codex', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the OpenAI Codex CLI', entry_point: './useCases/codex.ts' },
    { name: 'droid', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the Factory Droid CLI', entry_point: './useCases/droid.ts' },
    { name: 'gemini', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the Google Gemini CLI', entry_point: './useCases/gemini.ts' },
    { name: 'kimi', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the Kimi CLI', entry_point: './useCases/kimi.ts' },
    { name: 'opencode', version: '1.0.0', type: 'adapter' as const, description: 'Adapter for the OpenCode CLI', entry_point: './useCases/opencode.ts' },
];

/**
 * Resolve an agent adapter by name.
 * @param {string} name
 * @returns {object | undefined}
 */
export function get_adapter(name: string): (typeof adapters)[string] | undefined {
    return adapters[name];
}
