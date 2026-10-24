import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/** Closes with `true` only when the user confirms. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false" cdkFocusInitial>
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button mat-button type="button" [mat-dialog-close]="true">{{ data.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
