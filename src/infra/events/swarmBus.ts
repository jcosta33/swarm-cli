import { createEventBus } from './createEventBus.ts';
import type { SwarmEvents } from './swarmEvents.ts';

// Per-process singleton: each `swarm <command>` invocation spawns a fresh
// Node process and gets its own bus. Modules emit/subscribe through this
// import; tests can build a fresh bus via `createEventBus<SwarmEvents>()`.
export const swarmBus = createEventBus<SwarmEvents>();
