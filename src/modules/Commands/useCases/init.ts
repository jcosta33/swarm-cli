import {
    intro,
    outro,
    log,
    spinner,
    confirm,
    isCancel,
    cancel,
    text,
} from '@clack/prompts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import color from 'picocolors';

export async function cmd_init(repoRoot: string, _argv: string[]): Promise<number> {
    intro(color.bgCyan(color.black(' Swarm CLI Setup ')));

    const agentsDir = join(repoRoot, '.agents');

    if (existsSync(agentsDir)) {
        log.warn('.agents directory already exists in this repository.');

        const shouldReinit = await confirm({
            message: 'Do you want to re-initialize and overwrite configurations?',
            initialValue: false,
        });

        if (isCancel(shouldReinit) || !shouldReinit) {
            cancel('Setup aborted.');
            return 0;
        }
    }

    const s = spinner();
    s.start('Scaffolding Swarm CLI isolated environment...');

    if (!existsSync(agentsDir)) mkdirSync(agentsDir, { recursive: true });

    ['tasks', 'specs', 'audits', 'logs', 'releases'].forEach((d) => {
        const dirPath = join(agentsDir, d);
        if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
    });

    const scaffoldDir = join(
        new URL('.', import.meta.url).pathname,
        '../../scaffold'
    );
    if (existsSync(scaffoldDir)) {
        s.start('Copying scaffolded templates and skills...');
        cpSync(scaffoldDir, agentsDir, { recursive: true, force: false });
        s.stop('Scaffolded skills and templates.');
    }

    s.stop('Directory structure created.');

    s.start('Enabling git rerere for automatic conflict resolution...');
    const rerereRes = spawnSync('git', ['config', 'rerere.enabled'], { cwd: repoRoot, encoding: 'utf8' });
    if (rerereRes.stdout.trim() !== 'true') {
        spawnSync('git', ['config', 'rerere.enabled', 'true'], { cwd: repoRoot, encoding: 'utf8' });
        s.stop('Git rerere enabled.');
    } else {
        s.stop('Git rerere already enabled.');
    }

    const defaultTest = await text({
        message: 'What is your test command?',
        placeholder: 'npm test',
        defaultValue: 'npm test',
    });

    const defaultLint = await text({
        message: 'What is your lint or typecheck command?',
        placeholder: 'tsc --noEmit',
        defaultValue: 'tsc --noEmit',
    });

    if (isCancel(defaultTest) || isCancel(defaultLint)) {
        cancel('Setup aborted.');
        return 0;
    }

    s.start('Writing configuration...');

    const configPath = join(repoRoot, 'swarm.config.json');
    writeFileSync(
        configPath,
        JSON.stringify(
            {
                commands: {
                    install: 'npm install',
                    typecheck: defaultLint,
                    test: defaultTest,
                    validateDeps: 'npm ls',
                },
                agentRules: ['Always adhere to project linting rules.', 'Empirical proof is required before PR.'],
            },
            null,
            2
        ),
        'utf8'
    );

    s.stop(color.green('swarm.config.json created.'));

    log.message(
        `You can now use Swarm CLI!\n\n` +
            `1. Run ${color.cyan('swarm new <slug>')} to create a task.\n` +
            `2. Run ${color.cyan('swarm <aider|cline>')} to invoke an agent.\n` +
            `3. Check the ${color.green('.agents/tasks')} folder for templates.`
    );

    outro(color.cyan('Happy orchestrating!'));
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    void cmd_init(process.cwd(), process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
