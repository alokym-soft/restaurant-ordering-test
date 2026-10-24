import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import type { Category, CategoryId, ItemId, MenuItem } from '@restaurant/contracts';
import { ConfirmDialogComponent, type ConfirmDialogData, DIALOG_SIZE } from '@shared/ui';
import {
  SetupPageActions,
  categoryKey,
  itemKey,
  selectItemCountByCategory,
  selectPendingKeys,
  selectSetupCategories,
  selectSetupItemsByCategory,
} from '@setup/data-access';
import { type CategoryListEntry, CategoryListComponent } from '@setup/ui/category-list.component';
import {
  CategoryDialogComponent,
  type CategoryDialogData,
  type CategoryDialogResult,
} from '@setup/ui/category-dialog.component';
import { SETUP_ROW_HEIGHT, SetupItemRowComponent } from '@setup/ui/setup-item-row.component';
import { ItemPanelComponent, NEW_ITEM_ID } from './item-panel.component';

@Component({
  selector: 'app-setup-page',
  imports: [ScrollingModule, MatButtonModule, CategoryListComponent, SetupItemRowComponent, ItemPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-category-list
        class="categories"
        [entries]="categoryEntries()"
        [selectedId]="selectedCategoryId()"
        (selected)="selectCategory($event)"
        (create)="createCategory()"
        (edit)="editCategory($event)"
        (remove)="deleteCategory($event)"
      />
      <div class="items">
        <div class="items-head">
          <h2 class="truncate" [title]="selectedCategoryName()">{{ selectedCategoryName() }}</h2>
          <button mat-button type="button" [disabled]="!selectedCategoryId()" (click)="createItem()">Add item</button>
        </div>
        @if (items().length === 0) {
          <p class="empty">No items in this category.</p>
        } @else {
          <cdk-virtual-scroll-viewport class="viewport" [itemSize]="rowHeight">
            <app-setup-item-row
              *cdkVirtualFor="let item of items(); trackBy: trackItem"
              [item]="item"
              [pending]="pendingKeys().has(itemKey(item.id))"
              [selected]="item.id === itemParam()"
              (open)="openItem(item.id)"
              (availabilityChange)="toggleAvailability(item, $event)"
            />
          </cdk-virtual-scroll-viewport>
        }
      </div>
      <!-- Keyed by id, so switching items creates a fresh panel and form. -->
      @for (itemId of panelIds(); track itemId) {
        <app-item-panel [itemId]="itemId" [categoryId]="selectedCategoryId()" (closed)="closePanel($event)" />
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .page {
      position: relative;
      display: flex;
      gap: var(--space-4);
      height: 100%;
      padding: var(--space-4);
      box-sizing: border-box;
    }
    .categories {
      flex: 0 1 280px;
      min-width: 200px;
    }
    .items {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .items-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .items-head h2 {
      flex: 1;
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .viewport {
      flex: 1;
      min-height: 240px;
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 720px) {
      .page {
        flex-direction: column;
      }
      .categories {
        flex: 0 0 auto;
        max-height: 40vh;
      }
    }
  `,
})
export class SetupPageComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `?category=<id>`; the first category is used when absent or unknown. */
  readonly category = input<string | undefined>();
  /** `?item=<id>` edits an item, `?item=new` creates one in the selected category. */
  readonly item = input<string | undefined>();

  protected readonly rowHeight = SETUP_ROW_HEIGHT;
  protected readonly itemKey = itemKey;
  protected readonly trackItem = (_index: number, item: MenuItem): string => item.id;

  private readonly categories = this.store.selectSignal(selectSetupCategories);
  private readonly itemCounts = this.store.selectSignal(selectItemCountByCategory);
  private readonly itemsByCategory = this.store.selectSignal(selectSetupItemsByCategory);
  protected readonly pendingKeys = this.store.selectSignal(selectPendingKeys);

  protected readonly itemParam = computed(() => this.item() ?? null);
  protected readonly panelIds = computed(() => (this.item() ? [this.item() as string] : []));

  protected readonly categoryEntries = computed((): CategoryListEntry[] => {
    const counts = this.itemCounts();
    const pending = this.pendingKeys();
    return this.categories().map((category) => ({
      category,
      itemCount: counts.get(category.id) ?? 0,
      pending: pending.has(categoryKey(category.id)),
    }));
  });

  protected readonly selectedCategoryId = computed((): CategoryId | null => {
    const requested = this.category();
    const categories = this.categories();
    return categories.find((category) => category.id === requested)?.id ?? categories[0]?.id ?? null;
  });

  protected readonly selectedCategoryName = computed(
    () => this.categories().find((category) => category.id === this.selectedCategoryId())?.name ?? 'Items',
  );

  protected readonly items = computed((): MenuItem[] => {
    const id = this.selectedCategoryId();
    return (id && this.itemsByCategory().get(id)) || [];
  });

  protected selectCategory(id: CategoryId): void {
    void this.router.navigate([], { queryParams: { category: id }, queryParamsHandling: 'merge' });
  }

  protected openItem(id: ItemId): void {
    void this.router.navigate([], { queryParams: { item: id }, queryParamsHandling: 'merge' });
  }

  protected createItem(): void {
    void this.router.navigate([], {
      queryParams: { item: NEW_ITEM_ID, category: this.selectedCategoryId() },
      queryParamsHandling: 'merge',
    });
  }

  /** Removes `?item` and returns focus to the edited row, if it is rendered. */
  protected async closePanel(itemId: ItemId | null): Promise<void> {
    await this.router.navigate([], { queryParams: { item: null }, queryParamsHandling: 'merge' });
    if (!itemId) return;
    const row = this.host.nativeElement.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"] .open`);
    row?.focus();
  }

  protected toggleAvailability(item: MenuItem, available: boolean): void {
    this.store.dispatch(SetupPageActions.availabilityToggled({ id: item.id, available, expectedVersion: item.version }));
  }

  protected async createCategory(): Promise<void> {
    const last = this.categories().at(-1);
    const result = await this.openCategoryDialog({
      title: 'New category',
      name: '',
      sortOrder: (last?.sortOrder ?? 0) + 10,
    });
    if (result) this.store.dispatch(SetupPageActions.categoryCreated({ request: result }));
  }

  protected async editCategory(category: Category): Promise<void> {
    const result = await this.openCategoryDialog({
      title: 'Edit category',
      name: category.name,
      sortOrder: category.sortOrder,
    });
    if (!result) return;
    this.store.dispatch(
      SetupPageActions.categoryUpdated({
        id: category.id,
        request: { ...result, expectedVersion: category.version },
      }),
    );
  }

  protected async deleteCategory(category: Category): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: `Delete "${category.name}"?`,
        message: 'Only empty categories can be deleted. This cannot be undone.',
        confirmLabel: 'Delete',
      },
      ...DIALOG_SIZE,
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.store.dispatch(SetupPageActions.categoryDeleteConfirmed({ id: category.id }));
    }
  }

  private async openCategoryDialog(data: CategoryDialogData): Promise<CategoryDialogResult | undefined> {
    const ref = this.dialog.open<CategoryDialogComponent, CategoryDialogData, CategoryDialogResult>(
      CategoryDialogComponent,
      { data, ...DIALOG_SIZE },
    );
    return firstValueFrom(ref.afterClosed());
  }
}
