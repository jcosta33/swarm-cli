import { Container } from '../Container.ts';
import { testOverrides } from '../internal/containerState.ts';

import type { InjectableFunction } from '../inject.ts';

export const injectDependencies = <TInjectable extends InjectableFunction, TMocks extends Record<string, unknown>>(
    injectable: TInjectable,
    mocks: TMocks
) => {
    Container.clear();

    for (const key of Object.keys(injectable._deps)) {
        if (!(key in mocks)) {
            throw new Error(`Missing mock for dependency: ${key}`);
        }
    }

    for (const [key, mockValue] of Object.entries(mocks)) {
        let originalDep: unknown;
        if (injectable._options?.lazy) {
            const descriptor = Object.getOwnPropertyDescriptor(injectable._deps, key);
            // The getter function is used as a token (identity only); it is
            // not invoked here, so the unbound-`this` warning does not apply.
            // eslint-disable-next-line @typescript-eslint/unbound-method -- token identity, not invocation
            originalDep = descriptor?.get ?? injectable._deps[key];
        } else {
            originalDep = injectable._deps[key];
        }
        testOverrides.set(originalDep, mockValue);
    }

    return injectable;
};
