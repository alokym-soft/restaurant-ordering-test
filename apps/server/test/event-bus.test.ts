import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@restaurant/contracts';
import { EventBus } from '../src/events/event-bus.js';

const category = (id: string): Category => ({ id, name: id, sortOrder: 0, version: 1 });
const publish = (bus: EventBus, id: string) => bus.publish({ type: 'menu.category.upserted', payload: category(id) });

describe('EventBus', () => {
  it('stamps strictly increasing seq and the time', () => {
    const bus = new EventBus(10, () => new Date('2026-10-23T12:00:00Z'));
    expect(publish(bus, 'a')).toMatchObject({ seq: 1, at: '2026-10-23T12:00:00.000Z' });
    expect(publish(bus, 'b').seq).toBe(2);
    expect(bus.currentSeq).toBe(2);
  });

  it('replays events after lastSeq', () => {
    const bus = new EventBus(10);
    for (const id of ['a', 'b', 'c']) publish(bus, id);
    expect(bus.since(1)?.map((event) => event.seq)).toEqual([2, 3]);
    expect(bus.since(3)).toEqual([]);
  });

  it('returns null once events fell out of the buffer', () => {
    const bus = new EventBus(2);
    for (const id of ['a', 'b', 'c']) publish(bus, id);
    expect(bus.oldestAvailableSeq).toBe(2);
    expect(bus.since(1)?.map((event) => event.seq)).toEqual([2, 3]);
    expect(bus.since(0)).toBeNull();
  });

  it('returns null when the client is ahead of the server (restart)', () => {
    const bus = new EventBus(10);
    publish(bus, 'a');
    expect(bus.since(5)).toBeNull();
  });

  it('isolates failing listeners and supports unsubscribe', () => {
    const onError = vi.fn();
    const bus = new EventBus(10, undefined, onError);
    const healthy = vi.fn();
    bus.subscribe(() => {
      throw new Error('broken');
    });
    const unsubscribe = bus.subscribe(healthy);

    publish(bus, 'a');
    unsubscribe();
    publish(bus, 'b');

    expect(onError).toHaveBeenCalledTimes(2);
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
