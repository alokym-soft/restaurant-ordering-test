import { BehaviorSubject, Subject, defer } from 'rxjs';
import { Actions } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import type { Order, OrderEvent, OrdersSnapshot, ServerEvent } from '@restaurant/contracts';
import { ConnectionActions, type RealtimeService } from '@core/realtime';
import { ManualFrameScheduler } from '@shared/util/rx/testing/manual-frame-scheduler';
import { OrdersApiActions, OrdersStreamActions } from './orders.actions';
import type { OrdersListApi } from './orders.api';
import { loadOrders } from './orders.effects';
import { syncOrders } from './orders-sync';

const at = '2026-10-24T12:00:00.000Z';
const order = (id: string): Order => ({
  id,
  number: 1,
  lines: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  status: 'accepted',
  createdAt: at,
  updatedAt: at,
  version: 1,
});
const statusChanged = (seq: number, id: string): OrderEvent => ({
  seq,
  at,
  type: 'order.status.changed',
  payload: { id, status: 'preparing', version: 2, updatedAt: at },
});
const snapshot = (seq: number, orders: Order[] = []): OrdersSnapshot => ({ seq, orders });

describe('syncOrders', () => {
  it('buffers events while the snapshot loads and applies only newer ones in one action', () => {
    const snapshot$ = new Subject<OrdersSnapshot>();
    const events$ = new Subject<OrderEvent>();
    const scheduler = new ManualFrameScheduler();
    const actions: Action[] = [];
    syncOrders(snapshot$, events$, scheduler, new BehaviorSubject<number | null>(5)).subscribe((action) =>
      actions.push(action),
    );

    events$.next(statusChanged(4, 'o1'));
    events$.next(statusChanged(6, 'o1'));
    events$.next(statusChanged(7, 'o2'));
    snapshot$.next(snapshot(5, [order('o1'), order('o2')]));
    scheduler.frame();

    expect(actions).toEqual([
      OrdersApiActions.snapshotRequested(),
      OrdersApiActions.snapshotLoaded({ snapshot: snapshot(5, [order('o1'), order('o2')]) }),
      OrdersStreamActions.eventsApplied({ events: [statusChanged(6, 'o1'), statusChanged(7, 'o2')] }),
    ]);
  });

  it('reloads a snapshot older than welcome.serverSeq of the connection that delivers its events', () => {
    const snapshot$ = new Subject<OrdersSnapshot>();
    let requests = 0;
    const request$ = defer(() => {
      requests += 1;
      return snapshot$;
    });
    const events$ = new Subject<OrderEvent>();
    const streamStart$ = new BehaviorSubject<number | null>(null);
    const scheduler = new ManualFrameScheduler();
    const actions: Action[] = [];
    syncOrders(request$, events$, scheduler, streamStart$).subscribe((action) => actions.push(action));

    streamStart$.next(9); // welcome.serverSeq = 9 arrived before the snapshot response
    snapshot$.next(snapshot(8, [order('o1')])); // event 9 was never received: reload
    expect(requests).toBe(2);

    snapshot$.next(snapshot(9, [order('o1'), order('o2')]));
    expect(actions).toEqual([
      OrdersApiActions.snapshotRequested(),
      OrdersApiActions.snapshotLoaded({ snapshot: snapshot(9, [order('o1'), order('o2')]) }),
    ]);
  });
});

describe('loadOrders', () => {
  it('refetches the snapshot on resync and drops the stream of the previous one', () => {
    const actions$ = new Subject<Action>();
    const events$ = new Subject<ServerEvent>();
    const snapshots: Subject<OrdersSnapshot>[] = [];
    const api = {
      snapshot: () => {
        const next = new Subject<OrdersSnapshot>();
        snapshots.push(next);
        return next;
      },
    } as unknown as OrdersListApi;
    const realtime = { events$, streamStart$: new BehaviorSubject<number | null>(null) } as unknown as RealtimeService;
    const scheduler = new ManualFrameScheduler();
    const out: Action[] = [];
    loadOrders(new Actions(actions$), api, realtime, scheduler).subscribe((action) => out.push(action));

    snapshots[0]?.next(snapshot(10));
    actions$.next(ConnectionActions.resyncRequired({ serverSeq: 0 }));
    expect(snapshots).toHaveLength(2);

    // After a server restart the sequence starts again; events above the new snapshot apply.
    events$.next(statusChanged(1, 'o1'));
    snapshots[1]?.next(snapshot(0, [order('o1')]));
    scheduler.frame();
    expect(out.slice(-3)).toEqual([
      OrdersApiActions.snapshotRequested(),
      OrdersApiActions.snapshotLoaded({ snapshot: snapshot(0, [order('o1')]) }),
      OrdersStreamActions.eventsApplied({ events: [statusChanged(1, 'o1')] }),
    ]);
  });
});
