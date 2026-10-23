import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { ConnectionActions } from './connection.actions';
import type { ConnectionStatus } from './realtime.service';

export interface ConnectionState {
  status: ConnectionStatus;
  attempt: number;
  lastSeq: number | null;
}

export const initialConnectionState: ConnectionState = {
  status: 'connecting',
  attempt: 0,
  lastSeq: null,
};

export const connectionFeature = createFeature({
  name: 'connection',
  reducer: createReducer(
    initialConnectionState,
    on(ConnectionActions.stateChanged, (_, { state }): ConnectionState => ({ ...state })),
  ),
  extraSelectors: ({ selectStatus }) => ({
    selectIsOnline: createSelector(selectStatus, (status) => status === 'online'),
  }),
});
