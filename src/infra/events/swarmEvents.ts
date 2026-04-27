// Process-wide event map for the Swarm CLI. Add new events here as flows
// are decoupled from their listeners. Keeping the map narrow on purpose:
// every key is a real, fired-by-someone event — no aspirational placeholders.

export type SwarmEvents = {
    'agent.launched': {
        repoRoot: string;
        slug: string;
        agent: string;
        backend: string;
        startedAt: string;
    };
    'agent.session.recorded': {
        repoRoot: string;
        slug: string;
        agent: string;
        startedAt: string;
        finishedAt: string;
        exitCode: number | null;
    };
    'sandbox.created': {
        repoRoot: string;
        slug: string;
        branch: string;
        worktreePath: string;
    };
    'sandbox.removed': {
        repoRoot: string;
        slug: string;
    };
};
