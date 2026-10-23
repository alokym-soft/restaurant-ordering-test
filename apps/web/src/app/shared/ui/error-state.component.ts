import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/** Generic error panel with a user-safe message and a retry action. */
@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error" role="alert">
      <p class="title">{{ title() }}</p>
      <p class="message">{{ message() }}</p>
      <button mat-flat-button type="button" (click)="retry.emit()">{{ retryLabel() }}</button>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 48px 24px;
      text-align: center;
    }
    .title {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .message {
      margin: 0 0 8px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ErrorStateComponent {
  readonly title = input('Something went wrong');
  readonly message = input.required<string>();
  readonly retryLabel = input('Try again');
  readonly retry = output();
}
