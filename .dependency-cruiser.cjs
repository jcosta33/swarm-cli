/* (c) Copyright Sourdaw Ltd., all rights reserved. */
/** @type {import('dependency-cruiser').IConfiguration} */

// ----------------------------------------------------------------------------
// Swarm CLI module architecture enforcement
//
// Module structure:
//   src/modules/Workspace/     — git worktree primitives (core)
//   src/modules/AgentState/    — JSON state registry (core)
//   src/modules/TaskManagement/ — slug/template helpers
//   src/modules/Adapters/      — external agent tool configs
//   src/modules/Terminal/      — terminal launching, colors, CLI helpers
//   src/modules/Commands/      — CLI command implementations (orchestration)
//   src/utils/                 — pure, stateless utilities
//
// Rules:
//   - Cross-module imports MUST target the destination module's root index.ts.
//   - Same-module imports MUST use relative paths (never the module barrel).
//   - Core modules (Workspace, AgentState) must not depend on Commands or Terminal.
//   - Utils must be pure and stateless — no dependencies on modules.
// ----------------------------------------------------------------------------

module.exports = {
    forbidden: [
        {
            name: 'no-circular',
            severity: 'error',
            comment: 'Circular dependencies are forbidden.',
            from: {},
            to: { circular: true },
        },
        {
            name: 'core-isolation',
            severity: 'error',
            comment: 'Core modules (Workspace, AgentState) must not depend on Commands or Terminal.',
            from: { path: '^src/modules/(Workspace|AgentState)/' },
            to: { path: '^src/modules/(Commands|Terminal)/' },
        },
        {
            name: 'task-management-isolation',
            severity: 'error',
            comment: 'TaskManagement must not depend on Commands or Terminal.',
            from: { path: '^src/modules/TaskManagement/' },
            to: { path: '^src/modules/(Commands|Terminal)/' },
        },
        {
            name: 'adapters-isolation',
            severity: 'error',
            comment: 'Adapters define external tool logic. They cannot depend on Commands or Terminal.',
            from: { path: '^src/modules/Adapters/' },
            to: { path: '^src/modules/(Commands|Terminal)/' },
        },
        {
            name: 'utils-isolation',
            severity: 'error',
            comment: 'Utils must be pure and stateless. They cannot depend on any module.',
            from: { path: '^src/utils/' },
            to: { path: '^src/modules/' },
        },
    ],
    options: {
        doNotFollow: {
            path: ['node_modules'],
        },
        exclude: {
            path: '\\.(spec|test)\\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$',
        },
        includeOnly: ['src', 'bin'],
        moduleSystems: ['cjs', 'es6'],
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default', 'types'],
            mainFields: ['module', 'main', 'types', 'typings'],
            aliasFields: ['browser'],
        },
        skipAnalysisNotInRules: true,
        reporterOptions: {
            dot: {
                collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)',
            },
            archi: {
                collapsePattern:
                    '^(?:packages|src|lib(s?)|app(s?)|bin|test(s?)|spec(s?))/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)',
            },
            text: {
                highlightFocused: true,
            },
        },
        tsConfig: { fileName: 'tsconfig.json' },
    },
};
