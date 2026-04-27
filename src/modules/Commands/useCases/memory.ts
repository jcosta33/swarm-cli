import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';


/**
 * Ensures the memory directory exists.
 */
function getMemoryDir(repoRoot: string) {
    const memDir = join(repoRoot, '.agents', 'memory');
    if (!existsSync(memDir)) {
        mkdirSync(memDir, { recursive: true });
    }
    return memDir;
}

/**
 * Write a memory note.
 */
export function writeMemory(repoRoot: string, topic: string, content: string) {
    const memDir = getMemoryDir(repoRoot);
    const file = join(memDir, `${topic}.md`);
    
    let existing = '';
    if (existsSync(file)) {
        existing = `${readFileSync(file, 'utf8')}\n\n`;
    }
    
    const stamped = `## Entry (${new Date().toISOString()})\n${content}\n`;
    writeFileSync(file, existing + stamped, 'utf8');
    return file;
}

/**
 * Read all memories for a topic, or list topics.
 */
export function readMemory(repoRoot: string, topic: string | undefined) {
    const memDir = getMemoryDir(repoRoot);
    
    if (!topic) {
        if (!existsSync(memDir)) return [];
        return readdirSync(memDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    }

    const file = join(memDir, `${topic}.md`);
    if (!existsSync(file)) return null;
    
    return readFileSync(file, 'utf8');
}
