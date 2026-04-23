
import { write_state } from '../../AgentState/index.ts';
import { blue, bold, cyan, dim } from './colors.ts';

import { spawn, spawnSync } from 'child_process';
import { existsSync as fsExistsSync, mkdirSync as fsMkdirSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Resolve the effective terminal backend based on config/flag/platform.
 */
export function resolve_backend(requested: string): string {
    if (requested === 'auto') {
        if (process.platform === 'darwin') return 'terminal';
        if (process.platform === 'win32') return 'windows-auto';
        return 'linux-auto';
    }
    return requested;
}

/**
 * Build the banner string for display before agent launch.
 */
function build_banner(info: Record<string, string>): string {
    const titleWidth = Math.max(0, 50 - info.title.length - 3);
    return [
        `\n${cyan('┌')} ${bold(cyan(info.title))} ${cyan('─'.repeat(titleWidth))}`,
        `${cyan('│')} ${dim('Slug:')}      ${info.slug}`,
        `${cyan('│')} ${dim('Branch:')}    ${info.branch}`,
        `${cyan('│')} ${dim('Task file:')} ${info.taskFile}`,
        `${cyan('└' + '─'.repeat(50))}\n`,
        `${blue('i')} Launching ${bold(info.agent)}...\n`,
    ].join('\n');
}

/**
 * Launch the agent in the given backend.
 * @returns Exit code for 'current' backend; undefined for async backends.
 */
export function launch(backend: string, worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string): number | undefined {
    switch (backend) {
        case 'current':
            return launch_current(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
        case 'terminal':
            launch_terminal_app(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
            return;
        case 'iterm':
            launch_iterm(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
            return;
        case 'linux-auto':
            launch_linux_auto(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
            return;
        case 'windows-auto':
            launch_windows_auto(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
            return;
        default:
            throw new Error(`Unsupported terminal backend: "${backend}". Supported: auto, current, terminal, iterm`);
    }
}

/**
 * Launch in the current terminal session (blocking — agent takes over stdio).
 * @returns The agent process exit code.
 */
function launch_current(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string): number {
    process.stdout.write('\x1Bc'); // clear screen
    console.log(build_banner(bannerInfo));
    console.log('');

    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            backend: 'current',
            agent: bannerInfo.agent,
            status: 'running',
            pid: process.pid, // in current mode, the node script blocks and acts as the agent process owner
        });
    }

    const result = spawnSync(agentCmd, agentArgs, {
        cwd: worktreePath,
        stdio: 'inherit',
        shell: false,
    });

    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            status: result.error ? 'failed' : 'stopped',
            exitCode: result.status,
            error: result.error ? result.error.message : null,
        });
    }

    if (result.error) {
        // If --name is unsupported by the agent, retry without it
        const filteredArgs = strip_flag('--name', agentArgs);
        if (filteredArgs.length !== agentArgs.length) {
            const retry = spawnSync(agentCmd, filteredArgs, {
                cwd: worktreePath,
                stdio: 'inherit',
                shell: false,
            });
            if (retry.error) {
                throw new Error(`Failed to launch ${agentCmd}: ${retry.error.message}`);
            }
            return retry.status ?? 0;
        }
        throw new Error(`Failed to launch ${agentCmd}: ${result.error.message}`);
    }
    return result.status ?? 0;
}

/**
 * Remove a --flag <value> pair from an args array.
 */
function strip_flag(flag: string, args: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === flag) {
            i++;
            continue;
        }
        out.push(args[i]);
    }
    return out;
}

/**
 * Write a self-deleting launch script to a temp file, avoiding all
 * shell-escaping issues when passing paths/args through AppleScript.
 * @returns path to the temp script
 */
function write_launch_script(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string): string {
    const banner = build_banner(bannerInfo);

    let logSetup = '';
    if (repoRoot) {
        const logDir = join(repoRoot, '.agents', 'logs');
        if (!fsExistsSync(logDir)) fsMkdirSync(logDir, { recursive: true });
        const logFile = join(logDir, `${bannerInfo.slug}.log`);
        logSetup = `
LOG_FILE=${posix_quote(logFile)}
touch "$LOG_FILE"
echo "=== Agent Session Started at $(date) ===" >> "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1
`;
    }

    const lines = [
        '#!/bin/sh',
        `cd ${posix_quote(worktreePath)}`,
        'clear',
        logSetup,
        `printf '%s\\n\\n' ${posix_quote(banner)}`,
        [agentCmd, ...agentArgs].map(posix_quote).join(' '),
    ];
    const scriptPath = join(tmpdir(), `agents-launch-${String(process.pid)}-${String(Date.now())}.sh`);
    writeFileSync(scriptPath, lines.join('\n') + '\n', { mode: 0o755 });
    return scriptPath;
}

/**
 * POSIX single-quote a string so it is safe to embed in a shell command.
 */
function posix_quote(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Launch in a new macOS Terminal.app window.
 */
function launch_terminal_app(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string) {
    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            backend: 'terminal',
            agent: bannerInfo.agent,
            status: 'launched', // we don't have the PID for the AppleScript window
        });
    }
    const scriptPath = write_launch_script(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);

    // The only thing injected into AppleScript is the script path.
    // tmpdir() on macOS (/var/folders/... or /tmp) never contains single quotes.
    const appleScript = `
    tell application "Terminal"
      activate
      do script "exec sh ${posix_quote(scriptPath)}"
    end tell
  `;

    const result = spawnSync('osascript', ['-e', appleScript], {
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.status !== 0) {
        try {
            unlinkSync(scriptPath);
        } catch {
            /* best effort */
        }
        const err = (result.stderr || "").trim();
        throw new Error(`Failed to open Terminal.app: ${err || 'unknown AppleScript error'}`);
    }

    console.log(`Opened Terminal.app for: ${bannerInfo.slug}`);
}

/**
 * Launch in iTerm2.
 */
function launch_iterm(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string) {
    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            backend: 'iterm',
            agent: bannerInfo.agent,
            status: 'launched', // we don't have the PID for the AppleScript window
        });
    }
    const scriptPath = write_launch_script(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);

    const appleScript = `
    tell application "iTerm"
      activate
      tell current window
        create tab with default profile
        tell current session of current tab
          write text "exec sh ${posix_quote(scriptPath)}"
        end tell
      end tell
    end tell
  `;

    const result = spawnSync('osascript', ['-e', appleScript], {
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.status !== 0) {
        try {
            unlinkSync(scriptPath);
        } catch {
            /* best effort */
        }
        const err = (result.stderr || "").trim();
        throw new Error(`Failed to open iTerm2: ${err || 'unknown AppleScript error'}`);
    }

    console.log(`Opened iTerm2 for: ${bannerInfo.slug}`);
}

/**
 * Check if a terminal backend is available on this system.
 */
export function check_backend(backend: string): { ok: boolean; reason?: string } {
    switch (backend) {
        case 'current':
            return { ok: true };
        case 'terminal':
            if (process.platform !== 'darwin') return { ok: false, reason: 'Terminal.app is macOS only' };
            return { ok: true };
        case 'iterm': {
            if (process.platform !== 'darwin') return { ok: false, reason: 'iTerm2 is macOS only' };
            const r = spawnSync('osascript', ['-e', 'id of application "iTerm"'], {
                encoding: 'utf8',
                stdio: 'pipe',
            });
            return r.status === 0 ? { ok: true } : { ok: false, reason: 'iTerm2 not found' };
        }
        case 'linux-auto':
            if (process.platform === 'win32' || process.platform === 'darwin')
                return { ok: false, reason: 'linux-auto requires Linux' };
            return { ok: true };
        case 'windows-auto':
            if (process.platform !== 'win32') return { ok: false, reason: 'windows-auto requires Windows' };
            return { ok: true };
        case 'auto':
            return { ok: true }; // Resolve logic handles auto -> OS specific
        default:
            return { ok: false, reason: `Unknown terminal backend: ${backend}` };
    }
}

/**
 * Launch in a new Linux terminal.
 * Tries gnome-terminal, konsole, xfce4-terminal, xterm.
 */
function launch_linux_auto(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string) {
    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            backend: 'linux-auto',
            agent: bannerInfo.agent,
            status: 'launched',
        });
    }
    const scriptPath = write_launch_script(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);

    const terminals = [
        ['gnome-terminal', '--', 'bash', '-c'],
        ['konsole', '-e', 'bash', '-c'],
        ['xfce4-terminal', '-e', 'bash', '-c'],
        ['xterm', '-e', 'bash', '-c'],
    ];

    let launched = false;
    for (const [cmd, ...args] of terminals) {
        if (spawnSync('which', [cmd]).status === 0) {
            spawn(cmd, [...args, `"${scriptPath}"`], { detached: true, stdio: 'ignore' }).unref();
            launched = true;
            break;
        }
    }

    if (!launched) {
        console.error(`Could not find a supported Linux terminal. Falling back to current.`);
        const exitCode = launch_current(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);
        if (exitCode !== 0) {
            throw new Error(`Fallback launch failed with exit code ${String(exitCode)}`);
        }
    }
}

/**
 * Launch in a new Windows terminal.
 * Tries wt.exe (Windows Terminal) or falls back to cmd.exe.
 */
function launch_windows_auto(worktreePath: string, agentCmd: string, agentArgs: string[], bannerInfo: Record<string, string>, repoRoot: string) {
    if (repoRoot) {
        write_state(repoRoot, bannerInfo.slug, {
            backend: 'windows-auto',
            agent: bannerInfo.agent,
            status: 'launched',
        });
    }
    const scriptPath = write_launch_script(worktreePath, agentCmd, agentArgs, bannerInfo, repoRoot);

    const hasWt = spawnSync('where', ['wt']).status === 0;
    if (hasWt) {
        spawn('wt', ['-w', '0', 'nt', 'cmd', '/c', `"${scriptPath}"`], { detached: true, stdio: 'ignore' }).unref();
    } else {
        spawn('cmd', ['/c', 'start', 'cmd', '/c', `"${scriptPath}"`], { detached: true, stdio: 'ignore' }).unref();
    }
}
