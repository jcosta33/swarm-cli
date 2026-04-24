import {
    intro,
    outro,
    log,
    spinner,
    confirm,
    isCancel,
    cancel,
} from '@clack/prompts';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import { basename } from 'path';
import color from 'picocolors';
import { print_help } from './modules/Commands/useCases/help.ts';
import { run_dashboard } from './modules/Commands/useCases/dashboard.ts';
import { get_adapter } from './modules/Adapters/index.ts';

const AGENT_INSTALL_INFO: Record<string, { install: string; desc: string } | undefined> = {
    aider: { install: 'pip install aider-chat', desc: 'Interactive command-line pair-programming AI.' },
    cline: { install: 'npm install -g @cline/cli', desc: 'Autonomous engineering CLI agent.' },
    'swe-agent': { install: 'pip install swe-agent', desc: 'Headless agent for SWE tasks.' },
    claude: { install: 'npm install -g @anthropic-ai/claude-cli', desc: 'Anthropic Claude CLI agent.' },
    codex: { install: 'npm install -g @openai/codex', desc: 'OpenAI Codex CLI agent.' },
    droid: { install: 'npm install -g @factory/droid-cli', desc: 'Factory Droid CLI agent.' },
    gemini: { install: 'npm install -g @google/gemini-cli', desc: 'Google Gemini CLI agent.' },
    kimi: { install: 'npm install -g @moonshot/kimi-cli', desc: 'Moonshot Kimi CLI agent.' },
    opencode: { install: 'npm install -g opencode', desc: 'OpenCode CLI agent.' },
};

function get_git_info() {
    try {
        const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
        const repoName = repo ? basename(repo) : 'Standalone';
        const branch =
            spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
        const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim().length > 0;
        return { repoName, branch, dirty, worktree: process.cwd() };
    } catch {
        return { repoName: basename(process.cwd()), branch: 'N/A', dirty: false, worktree: process.cwd() };
    }
}

function extract_model_arg(args: string[]) {
    const modelIdx = args.findIndex((a) => a === '--model' || a === '-m');
    if (modelIdx !== -1 && args.length > modelIdx + 1) {
        return args[modelIdx + 1];
    }
    return 'default';
}

function print_agent_banner(agentName: string, args: string[]) {
    const info = get_git_info();
    const model = extract_model_arg(args);

    // Pick a stable color based on worktree path
    const colorsList = ['cyan', 'magenta', 'yellow', 'blue', 'green'] as const;
    const hash = info.worktree.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const themeColor = colorsList[hash % colorsList.length];
    const c = (color as unknown as Record<string, (text: string) => string>)[themeColor];

    // Set Terminal Title
    process.stdout.write(`\x1b]0;[Swarm] ${info.repoName} | ${info.branch}\x07`);

    console.clear();
    console.log(c('╔' + '━'.repeat(78) + '╗'));
    console.log(
        c('┃') + ' ' + color.bold(color.white(`🤖 SWARM EVOLUTION : ${(agentName).toUpperCase()}`)).padEnd(87) + c('┃')
    );
    console.log(c('┣' + '━'.repeat(78) + '┫'));

    const labels = [
        { label: 'Repo', val: color.white(info.repoName) },
        {
            label: 'Branch',
            val: color.white(info.branch) + (info.dirty ? color.red(' (dirty)') : color.green(' (clean)')),
        },
        { label: 'Worktree', val: color.dim(info.worktree.replace(os.homedir(), '~')) },
        { label: 'Model', val: color.magenta(model) },
        { label: 'Status', val: color.green('● ACTIVE') },
    ];

    for (const row of labels) {
        const text = `  ${c('■')} ${color.dim(row.label.padEnd(10))} ${row.val}`;
        console.log(c('┃') + text.padEnd(99) + c('┃'));
    }

    console.log(c('╚' + '━'.repeat(78) + '╝'));
    console.log('');
}

async function handle_unknown_command(cmd: string): Promise<number> {
    const adapter = get_adapter(cmd);
    const installInfo = AGENT_INSTALL_INFO[cmd];
    const executable = adapter ? adapter.command : installInfo ? cmd : null;

    if (executable) {
        const isInstalled =
            spawnSync('which', [executable]).status === 0 || spawnSync('where', [executable]).status === 0;

        if (!isInstalled && installInfo) {
            intro(color.bgCyan(color.black(' Swarm CLI ')));
            note(
                color.yellow(`Command '${cmd}' is not a built-in tool, but it matches a known agent CLI.`),
                'Unrecognized Command'
            );
            log.warn(`The agent '${cmd}' (${installInfo.desc}) is not installed on your system.`);

            const shouldInstall = await confirm({
                message: `Would you like Swarm CLI to install it for you using \`${installInfo.install}\`?`,
                initialValue: true,
            });

            if (isCancel(shouldInstall)) {
                cancel('Setup cancelled.');
                return 0;
            }

            if (shouldInstall) {
                const s = spinner();
                s.start(`Installing ${cmd}...`);
                const installParts = installInfo.install.split(' ');
                const installRes = spawnSync(installParts[0], installParts.slice(1), { shell: false, stdio: 'pipe' });

                if (installRes.status !== 0) {
                    s.stop(`Failed to install ${cmd}.`);
                    log.error(installRes.stderr.toString());
                    log.message(`Try installing manually: ${color.cyan(installInfo.install)}`);
                    return 1;
                }
                s.stop(color.green(`Successfully installed ${cmd}!`));
            } else {
                log.message(`You can install it manually via: ${color.cyan(installInfo.install)}`);
                return 0;
            }
            outro();
        } else if (!isInstalled) {
            intro(color.bgCyan(color.black(' Swarm CLI ')));
            log.error(color.red(`Agent '${cmd}' is not installed on your system.`));
            log.message(`Install the '${cmd}' CLI manually, then try again.`);
            outro();
            return 1;
        }

        // Massive, un-missable beautiful header
        print_agent_banner(cmd, process.argv.slice(3));

        spawnSync(executable, process.argv.slice(3), { stdio: 'inherit', shell: false });

        console.log('');
        outro(color.green(`Agent '${cmd}' execution completed.`));
        return 0;
    }

    intro(color.bgCyan(color.black(' Swarm CLI ')));
    log.error(color.red(`Unknown command: ${cmd}`));
    log.message('Use ' + color.cyan('swarm --help') + ' to see available commands.');
    log.info(
        color.dim(`If '${cmd}' is a project-specific script, add it to your swarm.config.json under "commands".`)
    );
    outro();
    return 1;
}

function note(message: string, title: string) {
    log.message(`${color.cyan('│')} ${color.bold(title)}\n${color.cyan('│')} ${message}`);
}

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    if (argv[0] === '--help' || argv[0] === '-h') {
        print_help();
        return 0;
    }

    if (argv.length === 0) {
        return run_dashboard();
    }

    const cmd = argv[0];

    // Sanitize command to prevent path traversal
    if (!/^[a-z0-9-]+$/.test(cmd)) {
        console.error(color.red(`Invalid command: ${cmd}`));
        return 1;
    }

    const commandPath = new URL(
        `./modules/Commands/useCases/${cmd}.ts`,
        import.meta.url
    );

    if (existsSync(commandPath.pathname)) {
        const res = spawnSync(
            process.execPath,
            ['--experimental-strip-types', commandPath.pathname, ...argv.slice(1)],
            {
                stdio: 'inherit',
                cwd: process.cwd(),
            }
        );
        // Forward signal exit codes correctly
        if (res.signal) {
            process.kill(process.pid, res.signal);
            return 1;
        }
        return res.status ?? 1;
    }

    return handle_unknown_command(cmd);
}

void main().then((code) => {
    process.exitCode = code;
});
