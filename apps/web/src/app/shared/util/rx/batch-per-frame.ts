import { InjectionToken } from '@angular/core';
import {
  Observable,
  type OperatorFunction,
  type SchedulerLike,
  type Subscription,
  animationFrameScheduler,
} from 'rxjs';

/**
 * Scheduler used to coalesce live updates into one store update per rendered frame.
 * Tests replace it with a synchronous or virtual-time scheduler.
 */
export const FRAME_SCHEDULER = new InjectionToken<SchedulerLike>('FRAME_SCHEDULER', {
  factory: () => animationFrameScheduler,
});

/**
 * Collects every batch received until the scheduler fires (one animation frame by default)
 * and emits them as a single array. Nothing is emitted for frames without input.
 * On completion the pending batch is flushed first; on error it is dropped.
 */
export function batchPerFrame<T>(scheduler: SchedulerLike = animationFrameScheduler): OperatorFunction<readonly T[], T[]> {
  return (source) =>
    new Observable<T[]>((subscriber) => {
      let pending: T[] = [];
      let scheduled: Subscription | null = null;

      const flush = (): void => {
        scheduled = null;
        if (pending.length === 0) return;
        const batch = pending;
        pending = [];
        subscriber.next(batch);
      };

      const subscription = source.subscribe({
        next: (values) => {
          pending.push(...values);
          scheduled ??= scheduler.schedule(flush);
        },
        error: (error: unknown) => subscriber.error(error),
        complete: () => {
          scheduled?.unsubscribe();
          flush();
          subscriber.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
        scheduled?.unsubscribe();
      };
    });
}
