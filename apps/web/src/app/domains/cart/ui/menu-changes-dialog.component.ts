import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import type { Minor } from '@restaurant/contracts';
import { formatMoney } from '@shared/util/money';

/** Mirrors `CheckoutReviewRow` from data-access; ui components do not import the store layer. */
export interface MenuChangesRow {
  lineId: string;
  name: string;
  quantity: number;
  outcome:
    | { kind: 'reprice'; from: Minor; to: Minor }
    | { kind: 'remove'; reason: 'unavailable' | 'removed' }
    | { kind: 'remove'; reason: 'out_of_range'; min: Minor; max: Minor };
}

export interface MenuChangesDialogData {
  rows: MenuChangesRow[];
  /** True when accepting removes every line. */
  cartWillBeEmpty: boolean;
}

/** `true` when the user accepts exactly the listed outcomes. */
export type MenuChangesDialogResult = boolean;

export function describeOutcome(outcome: MenuChangesRow['outcome']): string {
  if (outcome.kind === 'reprice') {
    return `Price ${formatMoney(outcome.from)} → ${formatMoney(outcome.to)}`;
  }
  switch (outcome.reason) {
    case 'unavailable':
      return 'Will be removed (unavailable)';
    case 'removed':
      return 'Will be removed (no longer on the menu)';
    case 'out_of_range':
      return `Will be removed (price out of allowed range ${formatMoney(outcome.min)} – ${formatMoney(outcome.max)})`;
  }
}

@Component({
  selector: 'app-menu-changes-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>The menu has changed</h2>
    <mat-dialog-content>
      <p>Review what will happen to your cart before placing the order:</p>
      <ul class="rows">
        @for (row of rows; track row.lineId) {
          <li class="row" [class.row--remove]="row.outcome.kind === 'remove'">
            <span class="name truncate" [title]="row.name">{{ row.quantity }} × {{ row.name }}</span>
            <span class="outcome">{{ describe(row.outcome) }}</span>
          </li>
        }
      </ul>
      @if (data.cartWillBeEmpty) {
        <p class="empty">Your cart will be empty, so no order will be placed.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Back to cart</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.cartWillBeEmpty ? 'Accept changes' : 'Accept and place order' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .name {
      font: var(--mat-sys-title-small);
    }
    .outcome {
      font: var(--mat-sys-body-medium);
    }
    .row--remove .outcome,
    .empty {
      color: var(--mat-sys-error);
    }
  `,
})
export class MenuChangesDialogComponent {
  protected readonly data = inject<MenuChangesDialogData>(MAT_DIALOG_DATA);
  protected readonly rows = this.data.rows;
  protected readonly describe = describeOutcome;
}
