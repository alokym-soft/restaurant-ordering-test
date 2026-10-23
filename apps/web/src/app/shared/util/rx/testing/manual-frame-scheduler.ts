import { type SchedulerAction, type SchedulerLike, Subscription } from 'rxjs';

/**
 * Test scheduler that runs scheduled work only when {@link frame} is called,
 * standing in for `animationFrameScheduler`.
 */
export class ManualFrameScheduler implements SchedulerLike {
  private queue: (() => void)[] = [];

  now(): number {
    return 0;
  }

  get pending(): number {
    return this.queue.length;
  }

  schedule<T>(work: (this: SchedulerAction<T>, state?: T) => void, _delay?: number, state?: T): Subscription {
    const task = (): void => work.call(undefined as unknown as SchedulerAction<T>, state);
    this.queue.push(task);
    return new Subscription(() => {
      this.queue = this.queue.filter((queued) => queued !== task);
    });
  }

  /** Runs everything scheduled so far, like one rendered frame. */
  frame(): void {
    const tasks = this.queue;
    this.queue = [];
    for (const task of tasks) task();
  }
}
