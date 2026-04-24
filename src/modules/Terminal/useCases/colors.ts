

// ANSI color wrappers for CLI output
const tty = process.stdout.isTTY;

const colors = {
    reset: tty ? '\x1b[0m' : '',
    bold: tty ? '\x1b[1m' : '',
    dim: tty ? '\x1b[2m' : '',
    italic: tty ? '\x1b[3m' : '',
    underline: tty ? '\x1b[4m' : '',
    inverse: tty ? '\x1b[7m' : '',
    hidden: tty ? '\x1b[8m' : '',
    strikethrough: tty ? '\x1b[9m' : '',
    black: tty ? '\x1b[30m' : '',
    red: tty ? '\x1b[31m' : '',
    green: tty ? '\x1b[32m' : '',
    yellow: tty ? '\x1b[33m' : '',
    blue: tty ? '\x1b[34m' : '',
    magenta: tty ? '\x1b[35m' : '',
    cyan: tty ? '\x1b[36m' : '',
    white: tty ? '\x1b[37m' : '',
    bgBlack: tty ? '\x1b[40m' : '',
    bgRed: tty ? '\x1b[41m' : '',
    bgGreen: tty ? '\x1b[42m' : '',
    bgYellow: tty ? '\x1b[43m' : '',
    bgBlue: tty ? '\x1b[44m' : '',
    bgMagenta: tty ? '\x1b[45m' : '',
    bgCyan: tty ? '\x1b[46m' : '',
    bgWhite: tty ? '\x1b[47m' : '',
};

function c(text: string, colorFn: unknown) {
    if (!tty) return text;
    return `${String(colorFn)}${text}${colors.reset}`;
}

export function red(text: string) {
    return c(text, colors.red);
}
export function green(text: string) {
    return c(text, colors.green);
}
export function yellow(text: string) {
    return c(text, colors.yellow);
}
export function blue(text: string) {
    return c(text, colors.blue);
}
export function cyan(text: string) {
    return c(text, colors.cyan);
}
export function dim(text: string) {
    return c(text, colors.dim);
}
export function bold(text: string) {
    return c(text, colors.bold);
}

import { logger } from '../services/logger.ts';

export function success(msg: string) {
    logger.info(`${green('✔')} ${bold(msg)}`);
}
export function info(msg: string) {
    logger.info(`${blue('i')} ${msg}`);
}
export function warn(msg: string) {
    logger.warn(`${yellow('⚠')} ${msg}`);
}
export function error(msg: string) {
    logger.error(`${red('✖')} ${bold(red('Error:'))} ${msg}`);
}

export function box(title: string, lines: string[]) {
    const content = lines.join('\n');
    logger.raw(`\n${cyan('┌')} ${bold(cyan(title))} ${cyan('─'.repeat(Math.max(0, 50 - title.length - 3)))}`);
    logger.raw(content);
    logger.raw(`${cyan('└' + '─'.repeat(50))}\n`);
}
