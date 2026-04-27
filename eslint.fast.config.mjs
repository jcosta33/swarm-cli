// @ts-check
// Fast (no-type-aware) variant of eslint.config.mjs. Disables every rule that
// requires the TypeScript program — drops linting time from minutes to ~1s
// on this codebase.

import tseslint from 'typescript-eslint';

import base from './eslint.config.mjs';

export default [
    ...base,
    {
        files: ['**/*.{ts,mts,cts}'],
        languageOptions: {
            parserOptions: {
                projectService: false,
                project: null,
            },
        },
        rules: Object.fromEntries(
            Object.entries(tseslint.plugin.rules ?? {})
                .filter(([, rule]) => rule.meta?.docs?.requiresTypeChecking)
                .map(([name]) => [`@typescript-eslint/${name}`, 'off'])
        ),
        // Disable directives might exist for type-aware rules; don't auto-prune them
        // in the fast pass.
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
    },
];
