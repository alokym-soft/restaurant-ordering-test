import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject } from 'rxjs';
import type { Action } from '@ngrx/store';
import { ConnectionActions } from './connection.actions';
import { resyncRequired } from './connection.effects';
import { connectionFeature, initialConnectionState } from './connection.feature';
import { RealtimeService, type ResyncRequired } from './realtime.service';

describe('connection feature', () => {
  it('stores the latest connection state', () => {
    const state = connectionFeature.reducer(
      initialConnectionState,
      ConnectionActions.stateChanged({ state: { status: 'online', attempt: 0, lastSeq: 7 } }),
    );
    expect(state).toEqual({ status: 'online', attempt: 0, lastSeq: 7 });
    expect(connectionFeature.selectIsOnline.projector(state.status)).toBe(true);
  });
});

describe('resyncRequired effect', () => {
  it('maps resync_required to [Connection] Resync Required', async () => {
    const resync$ = new Subject<ResyncRequired>();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(new Subject<Action>()),
        { provide: RealtimeService, useValue: { resyncRequired$: resync$ } },
      ],
    });
    const action = TestBed.runInInjectionContext(() => firstValueFrom(resyncRequired()));
    resync$.next({ serverSeq: 5, oldestAvailableSeq: 2 });
    expect(await action).toEqual(ConnectionActions.resyncRequired({ serverSeq: 5 }));
  });
});
