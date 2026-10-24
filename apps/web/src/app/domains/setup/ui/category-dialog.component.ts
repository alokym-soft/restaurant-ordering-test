import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface CategoryDialogData {
  title: string;
  name: string;
  sortOrder: number;
}

export interface CategoryDialogResult {
  name: string;
  sortOrder: number;
}

export const CATEGORY_NAME_MAX = 100;

@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="content">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" autocomplete="off" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Enter a name up to {{ nameMax }} characters</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Sort order</mat-label>
          <input matInput type="number" formControlName="sortOrder" step="1" />
          <mat-hint>Lower numbers come first</mat-hint>
          @if (form.controls.sortOrder.invalid) {
            <mat-error>Enter a whole number</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">Save</button>
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
export class CategoryDialogComponent {
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CategoryDialogComponent, CategoryDialogResult>>(MatDialogRef);

  protected readonly nameMax = CATEGORY_NAME_MAX;
  protected readonly form = new FormGroup({
    name: new FormControl(this.data.name, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CATEGORY_NAME_MAX), Validators.pattern(/\S/)],
    }),
    sortOrder: new FormControl<number | null>(this.data.sortOrder, {
      validators: [Validators.required, Validators.pattern(/^-?\d+$/)],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, sortOrder } = this.form.getRawValue();
    this.ref.close({ name: name.trim(), sortOrder: Number(sortOrder) });
  }
}
