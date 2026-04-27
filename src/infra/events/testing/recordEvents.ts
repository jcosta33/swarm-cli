import type { EventBus, EventMap } from '../types.ts';

export type RecordedEvent<TEvents extends EventMap> = {
    event: keyof TEvents & string;
    payload: TEvents[keyof TEvents];
};

export function recordEvents<TEvents extends EventMap>(bus: EventBus<TEvents>) {
    const entries: RecordedEvent<TEvents>[] = [];
    const stop = bus.onAny((event: keyof TEvents & string, payload: TEvents[keyof TEvents]) => {
        entries.push({ event, payload });
    });

    return {
        get entries() {
            return [...entries];
        },
        stop,
    };
}
