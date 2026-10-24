import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type AbstractControl, FormControl, FormGroup, ReactiveFormsModule, type ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Minor } from '@restaurant/contracts';
import { CURRENCY_SYMBOL, formatMoney, parseMoney } from '@shared/util/money';
import { MAX_QUANTITY } from './menu-item-row.component';

export interface OpenPriceDialogData {
  name: string;
  min: Minor;
  max: Minor;
  quantity: number;
}

export interface OpenPriceDialogResult {
  unitPrice: Minor;
  quantity: number;
}

/** Validates a price typed in major units against the item's limits, without floats. */
export function openPriceValidator(min: Minor, max: Minor) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = parseMoney(control.value ?? '');
    if (value === null) return { format: true };
    if (value < min || value > max) return { range: true };
    return null;
  };
}

@Component({
  selector: 'app-open-price-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="content">
        <mat-form-field>
          <mat-label>Your price</mat-label>
          <span matTextPrefix>{{ currencySymbol }}&nbsp;</span>
          <input matInput formControlName="price" inputmode="decimal" autocomplete="off" cdkFocusInitial />
          <mat-hint>From {{ minLabel }} to {{ maxLabel }}</mat-hint>
          @if (form.controls.price.hasError('format')) {
            <mat-error>Enter an amount like 120 or 120.50</mat-error>
          } @else if (form.controls.price.hasError('range')) {
            <mat-error>Must be from {{ minLabel }} to {{ maxLabel }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Quantity</mat-label>
          <input matInput type="number" formControlName="quantity" min="1" [max]="maxQuantity" />
          @if (form.controls.quantity.invalid) {
            <mat-error>From 1 to {{ maxQuantity }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">Add to cart</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
})
export class OpenPriceDialogComponent {
  protected readonly currencySymbol = CURRENCY_SYMBOL;
  protected readonly data = inject<OpenPriceDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<OpenPriceDialogComponent, OpenPriceDialogResult>>(MatDialogRef);

  protected readonly maxQuantity = MAX_QUANTITY;
  protected readonly minLabel = formatMoney(this.data.min);
  protected readonly maxLabel = formatMoney(this.data.max);

  protected readonly form = new FormGroup({
    price: new FormControl('', {
      nonNullable: true,
      validators: [openPriceValidator(this.data.min, this.data.max)],
    }),
    quantity: new FormControl(this.data.quantity, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(MAX_QUANTITY), Validators.pattern(/^\d+$/)],
    }),
  });

  protected submit(): void {
    const unitPrice = parseMoney(this.form.controls.price.value);
    if (this.form.invalid || unitPrice === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({ unitPrice, quantity: this.form.controls.quantity.value });
  }
}
