import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { RealtimeState } from './realtime.service';

export const ConnectionActions = createActionGroup({
  source: 'Connection',
  events: {
    'State Changed': props<{ state: RealtimeState }>(),
    /** The server could not replay missed events; every domain refetches its snapshot. */
    'Resync Required': props<{ serverSeq: number }>(),
    'Reconnect Requested': emptyProps(),
  },
});
