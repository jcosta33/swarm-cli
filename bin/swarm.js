#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptPath = join(__dirname, '../src/index.ts');
const res = spawnSync(
    process.execPath,
    ['--experimental-strip-types', scriptPath, ...process.argv.slice(2)],
    {
        stdio: 'inherit',
    }
);

// Forward signal terminations so the parent exits the same way the child did.
if (res.signal) {
    process.kill(process.pid, res.signal);
} else {
    process.exit(res.status ?? 1);
}
