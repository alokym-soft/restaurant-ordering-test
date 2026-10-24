import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { Category, CategoryId, MenuItem, Minor, Pricing } from '@restaurant/contracts';
import { parseMoney, toMajorString } from '@shared/util/money';

export const ITEM_NAME_MAX = 100;
export const ITEM_DESCRIPTION_MAX = 500;
export const MAX_AMOUNT: Minor = 100_000_000;

export interface ItemFormValue {
  categoryId: CategoryId;
  name: string;
  description: string;
  pricing: Pricing;
  available: boolean;
}

export interface ItemFormSave {
  value: ItemFormValue;
  /** Version the form was loaded from; `null` for a new item. */
  expectedVersion: number | null;
}

type PricingKind = Pricing['kind'];

function amount(text: string | null | undefined): Minor | null {
  const value = parseMoney(text ?? '');
  return value !== null && value <= MAX_AMOUNT ? value : null;
}

/** Fixed: a valid price. Open: valid limits with `min <= max` and `max >= 0.01`. */
export function pricingValidator(group: AbstractControl): ValidationErrors | null {
  const kind = group.get('pricingKind')?.value as PricingKind;
  if (kind === 'fixed') return amount(group.get('price')?.value) === null ? { price: true } : null;
  const min = amount(group.get('min')?.value);
  const max = amount(group.get('max')?.value);
  if (min === null || max === null) return { range: true };
  if (max < 1) return { range: true };
  return min <= max ? null : { order: true };
}

/**
 * Presentational item form. It tracks the version it was loaded from:
 * - while pristine, a newer `item` is loaded silently;
 * - while dirty, edits are kept and a notice offers to load the latest version;
 * - saving always sends the loaded version, so stale edits end in a version conflict.
 */
@Component({
  selector: 'app-item-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (newerAvailable()) {
      <div class="notice" role="status">
        <span>This item was changed elsewhere.</span>
        <button mat-button type="button" (click)="loadLatest()">Load latest</button>
      </div>
    }
    <form [formGroup]="form" (ngSubmit)="submit()" class="form">
      <mat-form-field>
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" autocomplete="off" />
        @if (form.controls.name.invalid) {
          <mat-error>Enter a name up to {{ nameMax }} characters</mat-error>
        }
      </mat-form-field>
      <mat-form-field>
        <mat-label>Description</mat-label>
        <textarea matInput formControlName="description" rows="3"></textarea>
        @if (form.controls.description.invalid) {
          <mat-error>Up to {{ descriptionMax }} characters</mat-error>
        }
      </mat-form-field>
      <mat-form-field>
        <mat-label>Category</mat-label>
        <mat-select formControlName="categoryId">
          @for (category of categories(); track category.id) {
            <mat-option [value]="category.id">{{ category.name }}</mat-option>
          }
        </mat-select>
        @if (form.controls.categoryId.invalid) {
          <mat-error>Choose a category</mat-error>
        }
      </mat-form-field>
      <mat-button-toggle-group formControlName="pricingKind" aria-label="Pricing">
        <mat-button-toggle value="fixed">Fixed price</mat-button-toggle>
        <mat-button-toggle value="open">Open price</mat-button-toggle>
      </mat-button-toggle-group>
      @if (form.controls.pricingKind.value === 'fixed') {
        <mat-form-field>
          <mat-label>Price, ₴</mat-label>
          <input matInput formControlName="price" inputmode="decimal" autocomplete="off" />
        </mat-form-field>
        @if (form.hasError('price') && form.controls.price.touched) {
          <p class="error" role="alert">Enter a price like 120 or 120.50</p>
        }
      } @else {
        <div class="range">
          <mat-form-field>
            <mat-label>Min, ₴</mat-label>
            <input matInput formControlName="min" inputmode="decimal" autocomplete="off" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Max, ₴</mat-label>
            <input matInput formControlName="max" inputmode="decimal" autocomplete="off" />
          </mat-form-field>
        </div>
        @if (form.hasError('range') && (form.controls.min.touched || form.controls.max.touched)) {
          <p class="error" role="alert">Enter both limits like 50 or 50.25; max must be above 0</p>
        } @else if (form.hasError('order')) {
          <p class="error" role="alert">Min must not exceed max</p>
        }
      }
      <mat-slide-toggle formControlName="available">Available</mat-slide-toggle>
      <div class="actions">
        <button mat-button type="button" (click)="cancelled.emit()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .range {
      display: flex;
      gap: 8px;
    }
    .range mat-form-field {
      flex: 1;
    }
    .notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      padding: 4px 4px 4px 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .error {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class ItemFormComponent {
  /** Latest item from the store; `null` creates a new item. */
  readonly item = input<MenuItem | null>(null);
  readonly categories = input.required<Category[]>();
  /** Category preselected for a new item. */
  readonly defaultCategoryId = input<CategoryId | null>(null);
  readonly saving = input(false);
  readonly save = output<ItemFormSave>();
  readonly cancelled = output();

  protected readonly nameMax = ITEM_NAME_MAX;
  protected readonly descriptionMax = ITEM_DESCRIPTION_MAX;

  /** The version the form shows; edits are saved against it. */
  private readonly loadedFrom = signal<MenuItem | null>(null);
  protected readonly newerAvailable = signal(false);

  protected readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(ITEM_NAME_MAX), Validators.pattern(/\S/)],
      }),
      description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(ITEM_DESCRIPTION_MAX)] }),
      categoryId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      pricingKind: new FormControl<PricingKind>('fixed', { nonNullable: true }),
      price: new FormControl('', { nonNullable: true }),
      min: new FormControl('', { nonNullable: true }),
      max: new FormControl('', { nonNullable: true }),
      available: new FormControl(true, { nonNullable: true }),
    },
    { validators: pricingValidator },
  );

  constructor() {
    effect(() => {
      const item = this.item();
      const defaultCategoryId = this.defaultCategoryId();
      untracked(() => this.sync(item, defaultCategoryId));
    });
  }

  /** Replaces the form content with `item`, discarding edits. Used for "Load latest" and conflicts. */
  load(item: MenuItem): void {
    const pricing = item.pricing;
    this.form.reset({
      name: item.name,
      description: item.description ?? '',
      categoryId: item.categoryId,
      pricingKind: pricing.kind,
      price: pricing.kind === 'fixed' ? toMajorString(pricing.price) : '',
      min: pricing.kind === 'open' ? toMajorString(pricing.min) : '',
      max: pricing.kind === 'open' ? toMajorString(pricing.max) : '',
      available: item.available,
    });
    this.loadedFrom.set(item);
    this.newerAvailable.set(false);
  }

  protected loadLatest(): void {
    const item = this.item();
    if (item) this.load(item);
  }

  private sync(item: MenuItem | null, defaultCategoryId: CategoryId | null): void {
    if (!item) {
      if (this.form.pristine) this.form.reset({ ...this.form.getRawValue(), categoryId: defaultCategoryId ?? '' });
      return;
    }
    const loaded = this.loadedFrom();
    if (!loaded || loaded.id !== item.id) {
      this.load(item);
    } else if (item.version > loaded.version) {
      if (this.form.pristine) this.load(item);
      else this.newerAvailable.set(true);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const pricing: Pricing =
      raw.pricingKind === 'fixed'
        ? { kind: 'fixed', price: amount(raw.price) ?? 0 }
        : { kind: 'open', min: amount(raw.min) ?? 0, max: amount(raw.max) ?? 0 };
    this.save.emit({
      value: {
        categoryId: raw.categoryId,
        name: raw.name.trim(),
        description: raw.description.trim(),
        pricing,
        available: raw.available,
      },
      expectedVersion: this.item() ? (this.loadedFrom()?.version ?? null) : null,
    });
  }
}
