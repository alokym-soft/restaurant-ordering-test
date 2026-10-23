import { Subject } from 'rxjs';
import { batchPerFrame } from './batch-per-frame';
import { ManualFrameScheduler } from './testing/manual-frame-scheduler';

describe('batchPerFrame', () => {
  let scheduler: ManualFrameScheduler;
  let source: Subject<number[]>;
  let batches: number[][];

  beforeEach(() => {
    scheduler = new ManualFrameScheduler();
    source = new Subject<number[]>();
    batches = [];
    source.pipe(batchPerFrame<number>(scheduler)).subscribe((batch) => batches.push(batch));
  });

  it('emits everything received in one frame as a single batch', () => {
    source.next([1]);
    source.next([2, 3]);
    expect(batches).toEqual([]);
    expect(scheduler.pending).toBe(1);

    scheduler.frame();
    expect(batches).toEqual([[1, 2, 3]]);
  });

  it('starts a new batch after each frame and stays idle without input', () => {
    source.next([1]);
    scheduler.frame();
    scheduler.frame();
    source.next([2]);
    scheduler.frame();
    expect(batches).toEqual([[1], [2]]);
    expect(scheduler.pending).toBe(0);
  });

  it('flushes the pending batch on completion', () => {
    let completed = false;
    source.pipe(batchPerFrame<number>(scheduler)).subscribe({ complete: () => (completed = true) });
    source.next([7]);
    source.complete();
    expect(batches).toEqual([[7]]);
    expect(completed).toBe(true);
    expect(scheduler.pending).toBe(0);
  });

  it('cancels the scheduled flush on unsubscribe', () => {
    const local = new Subject<number[]>();
    const received: number[][] = [];
    const subscription = local.pipe(batchPerFrame<number>(scheduler)).subscribe((batch) => received.push(batch));
    local.next([1]);
    subscription.unsubscribe();
    scheduler.frame();
    expect(received).toEqual([]);
  });
});
