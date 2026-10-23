import { Injectable, Injector, inject } from '@angular/core';
import type { MatSnackBar } from '@angular/material/snack-bar';
import { take } from 'rxjs';

export interface NotifyOptions {
  /** Label of the action button, for example "Retry". */
  action?: string;
  onAction?: () => void;
  durationMs?: number;
}

/**
 * User-facing notifications. Messages must already be safe to show.
 *
 * The snack bar (and the CDK overlay it needs) is loaded on demand, which keeps it out of the
 * initial bundle; {@link preload} fetches it right after startup so notifications still work
 * if the connection drops later.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly injector = inject(Injector);
  private snackBar: Promise<MatSnackBar> | null = null;

  preload(): void {
    void this.load().catch(() => undefined);
  }

  info(message: string, options: NotifyOptions = {}): void {
    this.open(message, options, 'app-snack-info', 4000);
  }

  error(message: string, options: NotifyOptions = {}): void {
    // Errors with an action stay until the user reacts.
    this.open(message, options, 'app-snack-error', options.action ? undefined : 6000);
  }

  private load(): Promise<MatSnackBar> {
    this.snackBar ??= import('@angular/material/snack-bar')
      .then(({ MatSnackBar }) => this.injector.get(MatSnackBar))
      .catch((error: unknown) => {
        // Allow a later attempt, for example after the network comes back.
        this.snackBar = null;
        throw error;
      });
    return this.snackBar;
  }

  private open(message: string, options: NotifyOptions, panelClass: string, defaultDuration?: number): void {
    this.load().then(
      (snackBar) => {
        const ref = snackBar.open(message, options.action ?? 'Dismiss', {
          duration: options.durationMs ?? defaultDuration,
          panelClass,
        });
        const onAction = options.onAction;
        if (onAction) {
          ref.onAction().pipe(take(1)).subscribe(() => onAction());
        }
      },
      (error: unknown) => console.error('Notification could not be shown:', message, error),
    );
  }
}
