interface Capability {
    name: string;
    version: string;
    type: 'command' | 'adapter' | 'skill';
    description: string;
    entry_point: string;
}

const registry = new Map<string, Capability>();

export function register_capability(capability: Capability): void {
    if (registry.has(capability.name)) {
        throw new Error(`Capability ${capability.name} is already registered`);
    }
    registry.set(capability.name, capability);
}

export function get_capability(name: string): Capability | undefined {
    return registry.get(name);
}

export function find_capabilities(filter: Partial<Capability>): Capability[] {
    return [...registry.values()].filter((capability) =>
        (Object.entries(filter) as [string, string | undefined][]).every(
            ([key, value]) => value === undefined || capability[key as keyof Capability] === value
        )
    );
}

export function list_capabilities(): Capability[] {
    return [...registry.values()];
}
