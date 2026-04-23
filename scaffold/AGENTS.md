# Swarm CLI Architecture & Conventions

This document defines the core architecture, coding standards, and agent workflows. All agents MUST read and adhere to these rules.

## Core Architectural Principles

1.  **Strict Modularity:** Code is organized into cohesive modules based on domain boundaries (e.g., Domain-Driven Design).
2.  **Explicit Dependencies:** Modules communicate through explicitly defined boundaries. Avoid circular dependencies.
3.  **Type Safety:** Leverage TypeScript's strict type system to ensure correctness and prevent runtime errors.

## Code Structure

-   `src/modules/`: Contains domain-specific modules. Each module should have its own internal structure (e.g., `useCases`, `models`).
-   `src/utils/`: Contains generic utility functions and cross-cutting concerns that don't belong to a specific module.
-   `src/index.ts`: The main entry point of the application.

## Conventions

-   **Naming:** 
    - Variables, functions, and object properties: `snake_case`.
    - Classes and Interfaces: `PascalCase`.
    - File names: `kebab-case.ts`.
-   **No Magic:** Prefer explicit logic over implicit "magic." No prototype pollution or global state mutation.
-   **Error Handling:** Use explicit return types for errors where possible, or throw descriptive custom errors.

## Testing

-   All new features and bug fixes MUST be accompanied by automated tests.
-   Tests should reside next to the code they verify, or in a dedicated `tests/` directory, following the project's established pattern.

## Workflow

1.  **Plan:** Before writing code, ensure a task or spec file exists in `.agents/`.
2.  **Implement:** Write clean, idiomatic TypeScript.
3.  **Verify:** Run linters and tests. Never submit code that breaks the build or fails tests.
