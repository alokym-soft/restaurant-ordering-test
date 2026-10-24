import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { Category, CategoryId } from '@restaurant/contracts';

export interface CategoryListEntry {
  category: Category;
  itemCount: number;
  pending: boolean;
}

@Component({
  selector: 'app-category-list',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h2>Categories</h2>
      <button mat-button type="button" (click)="create.emit()">Add</button>
    </div>
    <ul class="list" aria-label="Categories">
      @for (entry of entries(); track entry.category.id) {
        <li
          class="row"
          [class.row--selected]="entry.category.id === selectedId()"
          [attr.aria-busy]="entry.pending"
        >
          <button
            type="button"
            class="select"
            [attr.aria-current]="entry.category.id === selectedId() ? 'true' : null"
            (click)="selected.emit(entry.category.id)"
          >
            <span class="name">{{ entry.category.name }}</span>
            <span class="meta">#{{ entry.category.sortOrder }} · {{ entry.itemCount }} items</span>
          </button>
          <span class="pending" [class.pending--visible]="entry.pending">Saving…</span>
          <button mat-button type="button" [attr.aria-label]="'Edit ' + entry.category.name" (click)="edit.emit(entry.category)">
            Edit
          </button>
          <button
            mat-button
            type="button"
            [attr.aria-label]="'Delete ' + entry.category.name"
            (click)="remove.emit(entry.category)"
          >
            Delete
          </button>
        </li>
      } @empty {
        <li class="empty">No categories yet.</li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
    }
    .head h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .list {
      flex: 1;
      overflow: auto;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 4px;
      border-radius: 8px;
    }
    .row--selected {
      background: var(--mat-sys-secondary-container);
    }
    .select {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 8px;
      border: 0;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .name {
      font: var(--mat-sys-title-small);
    }
    .meta,
    .pending,
    .empty {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .pending {
      width: 56px;
      visibility: hidden;
    }
    .pending--visible {
      visibility: visible;
    }
    .empty {
      padding: 8px;
    }
  `,
})
export class CategoryListComponent {
  readonly entries = input.required<CategoryListEntry[]>();
  readonly selectedId = input<CategoryId | null>(null);
  readonly selected = output<CategoryId>();
  readonly create = output();
  readonly edit = output<Category>();
  readonly remove = output<Category>();
}
