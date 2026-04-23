
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface AgentConfig {
    command: string;
    args: string[];
};

interface SwarmConfig {
    defaultBaseBranch?: string;
    worktreeDirPattern?: string;
    defaultTerminal?: string;
    defaultAgent?: string;
    commands?: Record<string, string>;
    agents?: Record<string, AgentConfig>;
    reuseExistingByDefault?: boolean;
    writeTaskTemplateOnCreate?: boolean;
    openTaskFileInBanner?: boolean;
    allowSparseCheckout?: boolean;
    slugMaxLen?: number;
};

const DEFAULTS: SwarmConfig = {
    defaultBaseBranch: 'main',
    worktreeDirPattern: '../{repoName}--{slug}',
    defaultTerminal: 'auto',
    defaultAgent: 'claude',
    commands: {
        install: 'pnpm i',
        typecheck: 'pnpm typecheck',
        validateDeps: 'pnpm deps:validate',
        test: 'pnpm test',
    },
    agents: {
        claude: { command: 'claude', args: [] },
        gemini: { command: 'gemini', args: [] },
        codex: { command: 'codex', args: [] },
    },
    reuseExistingByDefault: true,
    writeTaskTemplateOnCreate: true,
    openTaskFileInBanner: true,
    allowSparseCheckout: false,
    slugMaxLen: 60,
};

/**
 * Load and merge scripts/agents/config.json with defaults.
 * @param {string} repoRoot
 * @returns {SwarmConfig}
 */
export function load_config(repoRoot: string): SwarmConfig {
    const primaryPath = join(repoRoot, 'swarm.config.json');
    const legacyPath = join(repoRoot, 'scripts', 'agents', 'config.json');
    const configPath = existsSync(primaryPath) ? primaryPath : legacyPath;
    if (!existsSync(configPath)) {
        return { ...DEFAULTS };
    }
    let raw: SwarmConfig;
    try {
        raw = JSON.parse(readFileSync(configPath, 'utf8')) as SwarmConfig;
    } catch (_e: unknown) {
        console.warn(`Warning: ${configPath} is malformed. Using defaults.`);
        return { ...DEFAULTS };
    }
    return {
        ...DEFAULTS,
        ...raw,
        agents: { ...DEFAULTS.agents, ...(raw.agents ?? {}) },
    };
}
