import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { take } from 'rxjs';

export interface NotifyOptions {
  /** Label of the action button, for example "Retry". */
  action?: string;
  onAction?: () => void;
  durationMs?: number;
}

/** User-facing notifications. Messages must already be safe to show. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  info(message: string, options: NotifyOptions = {}): void {
    this.open(message, options, 'app-snack-info', 4000);
  }

  error(message: string, options: NotifyOptions = {}): void {
    // Errors with an action stay until the user reacts.
    this.open(message, options, 'app-snack-error', options.action ? undefined : 6000);
  }

  private open(message: string, options: NotifyOptions, panelClass: string, defaultDuration?: number): void {
    const ref = this.snackBar.open(message, options.action ?? 'Dismiss', {
      duration: options.durationMs ?? defaultDuration,
      panelClass,
    });
    const onAction = options.onAction;
    if (onAction) {
      ref.onAction().pipe(take(1)).subscribe(() => onAction());
    }
  }
}
