#!/usr/bin/env node

import { parse_args, red, green, dim, logger } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import {
    prune_events,
    prune_sessions,
    query_sessions,
} from '../../AgentState/services/telemetry.ts';

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch {
        logger.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { flags } = parse_args(process.argv.slice(2));
    const asJson = flags.get('json') === true;
    const agent = flags.get('agent') as string | undefined;
    const slug = flags.get('slug') as string | undefined;
    const follow = flags.get('follow') === true;
    const pruneDaysRaw = flags.get('prune') as string | undefined;

    if (pruneDaysRaw !== undefined) {
        const days = parseInt(pruneDaysRaw, 10);
        if (Number.isNaN(days)) {
            logger.error(red('Invalid --prune value. Expected number of days.'));
            return 1;
        }
        const eventsDeleted = prune_events(repoRoot, days);
        const sessionsDeleted = prune_sessions(repoRoot, days);
        logger.info(green(`Pruned ${String(eventsDeleted)} events and ${String(sessionsDeleted)} sessions older than ${String(days)} days.`));
        return 0;
    }

    if (follow) {
        logger.info(dim('Following telemetry stream (Ctrl+C to stop)...\n'));
        let lastCount = 0;
        const poll = () => {
            const latest = query_sessions(repoRoot, 50);
            let filtered = latest;
            if (agent) filtered = filtered.filter((s) => s.agent === agent);
            if (slug) filtered = filtered.filter((s) => s.slug === slug);
            if (filtered.length > lastCount) {
                const newSessions = filtered.slice(lastCount);
                for (const session of newSessions) {
                    const duration = session.finished_at
                        ? `${String(Math.round((new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000))}s`
                        : 'running';
                    logger.raw(`  ${session.slug.padEnd(20)} ${session.agent.padEnd(10)} ${duration.padEnd(10)} exit:${String(session.exit_code ?? '-')}  ${dim(session.started_at)}`);
                }
                lastCount = filtered.length;
            }
        };
        poll();
        const interval = setInterval(poll, 2000);
        process.on('SIGINT', () => {
            clearInterval(interval);
            logger.raw('');
            return;
        });
        return 0;
    }

    const sessions = query_sessions(repoRoot, 50);

    if (sessions.length === 0) {
        logger.info(dim('No sessions found.'));
        return 0;
    }

    let filtered = sessions;
    if (agent) {
        filtered = filtered.filter((s) => s.agent === agent);
    }
    if (slug) {
        filtered = filtered.filter((s) => s.slug === slug);
    }

    if (asJson) {
        logger.raw(JSON.stringify(filtered, null, 2));
        return 0;
    }

    logger.raw('Recent sessions:\n');
    for (const session of filtered) {
        const duration = session.finished_at
            ? `${String(Math.round((new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000))}s`
            : 'running';
        logger.raw(`  ${session.slug.padEnd(20)} ${session.agent.padEnd(10)} ${duration.padEnd(10)} exit:${String(session.exit_code ?? '-')}`);
    }

    logger.raw(`\nTotal: ${String(filtered.length)} sessions\n`);
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
