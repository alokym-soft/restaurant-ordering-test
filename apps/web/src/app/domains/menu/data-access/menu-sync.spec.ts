import { Subject } from 'rxjs';
import type { Action } from '@ngrx/store';
import type { MenuEvent, MenuSnapshot } from '@restaurant/contracts';
import { ManualFrameScheduler } from '@shared/util/rx/testing/manual-frame-scheduler';
import { MenuApiActions, MenuStreamActions } from './menu.actions';
import { isMenuEvent, syncMenu } from './menu-sync';
import { fixedItem, itemUpserted, snapshot } from './testing/menu-fixtures';

describe('syncMenu', () => {
  let snapshot$: Subject<MenuSnapshot>;
  let events$: Subject<MenuEvent>;
  let scheduler: ManualFrameScheduler;
  let actions: Action[];

  beforeEach(() => {
    snapshot$ = new Subject();
    events$ = new Subject();
    scheduler = new ManualFrameScheduler();
    actions = [];
    syncMenu(snapshot$, events$, scheduler).subscribe((action) => actions.push(action));
  });

  const types = () => actions.map((action) => action.type);

  it('requests, then buffers events until the snapshot and drops the ones it already contains', () => {
    expect(types()).toEqual([MenuApiActions.snapshotRequested.type]);

    events$.next(itemUpserted(5, fixedItem('old')));
    events$.next(itemUpserted(11, fixedItem('new')));
    snapshot$.next(snapshot(10, [], []));

    expect(types()).toEqual([MenuApiActions.snapshotRequested.type, MenuApiActions.snapshotLoaded.type]);

    scheduler.frame();
    expect(actions[2]).toEqual(MenuStreamActions.eventsApplied({ events: [itemUpserted(11, fixedItem('new'))] }));
  });

  it('applies all live events of one frame with a single action', () => {
    snapshot$.next(snapshot(0, [], []));
    for (let seq = 1; seq <= 50; seq++) events$.next(itemUpserted(seq, fixedItem(`i${seq}`)));
    scheduler.frame();

    const applied = actions.filter((action) => action.type === MenuStreamActions.eventsApplied.type);
    expect(applied).toHaveLength(1);
    expect((applied[0] as ReturnType<typeof MenuStreamActions.eventsApplied>).events).toHaveLength(50);
  });

  it('turns a snapshot error into a failure action with a safe message', () => {
    snapshot$.error({ code: 'INTERNAL', message: 'Server down', status: 500 });
    expect(actions.at(-1)).toEqual(
      MenuApiActions.snapshotFailed({ error: { code: 'INTERNAL', message: 'Server down', status: 500 } }),
    );
  });

  it('recognizes menu events only', () => {
    expect(isMenuEvent(itemUpserted(1, fixedItem('a')))).toBe(true);
    expect(
      isMenuEvent({
        seq: 1,
        at: '',
        type: 'order.status.changed',
        payload: { id: 'o', status: 'ready', version: 2, updatedAt: '' },
      }),
    ).toBe(false);
  });
});
