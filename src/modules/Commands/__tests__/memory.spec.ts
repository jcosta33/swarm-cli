import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeMemory, readMemory } from '../useCases/memory.ts';

describe('memory module', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'swarm-memory-test-'));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('writes memory file and returns path', () => {
        const filePath = writeMemory(tempDir, 'design', 'Use SQLite for state.');
        expect(existsSync(filePath)).toBe(true);
        const content = readFileSync(filePath, 'utf8');
        expect(content).toContain('Use SQLite for state.');
        expect(content).toContain('## Entry');
    });

    it('appends to existing memory file', () => {
        writeMemory(tempDir, 'design', 'First note.');
        writeMemory(tempDir, 'design', 'Second note.');
        const content = readMemory(tempDir, 'design');
        expect(content).toContain('First note.');
        expect(content).toContain('Second note.');
    });

    it('lists topics when no topic is provided', () => {
        writeMemory(tempDir, 'design', 'Note 1');
        writeMemory(tempDir, 'backend', 'Note 2');
        const topics = readMemory(tempDir, undefined);
        expect(topics).toContain('design');
        expect(topics).toContain('backend');
    });

    it('returns null for non-existent topic', () => {
        const result = readMemory(tempDir, 'nonexistent');
        expect(result).toBeNull();
    });

    it('returns empty array when no memories exist and topic is undefined', () => {
        const topics = readMemory(tempDir, undefined);
        expect(topics).toEqual([]);
    });
});
