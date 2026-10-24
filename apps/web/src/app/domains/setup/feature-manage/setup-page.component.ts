import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import type { Category, CategoryId } from '@restaurant/contracts';
import { ConfirmDialogComponent, type ConfirmDialogData } from '@shared/ui';
import {
  SetupPageActions,
  categoryKey,
  selectItemCountByCategory,
  selectPendingKeys,
  selectSetupCategories,
} from '@setup/data-access';
import { type CategoryListEntry, CategoryListComponent } from '@setup/ui/category-list.component';
import {
  CategoryDialogComponent,
  type CategoryDialogData,
  type CategoryDialogResult,
} from '@setup/ui/category-dialog.component';

@Component({
  selector: 'app-setup-page',
  imports: [CategoryListComponent],
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
      <div class="items"></div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .page {
      display: flex;
      gap: 16px;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
    }
    .categories {
      flex: 0 0 320px;
    }
    .items {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
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

  /** `?category=<id>`; the first category is used when absent or unknown. */
  readonly category = input<string | undefined>();

  private readonly categories = this.store.selectSignal(selectSetupCategories);
  private readonly itemCounts = this.store.selectSignal(selectItemCountByCategory);
  protected readonly pendingKeys = this.store.selectSignal(selectPendingKeys);

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

  protected selectCategory(id: CategoryId): void {
    void this.router.navigate([], { queryParams: { category: id }, queryParamsHandling: 'merge' });
  }

  protected async createCategory(): Promise<void> {
    const last = this.categories().at(-1);
    const result = await this.openCategoryDialog({ title: 'New category', name: '', sortOrder: (last?.sortOrder ?? 0) + 10 });
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
      width: '400px',
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.store.dispatch(SetupPageActions.categoryDeleteConfirmed({ id: category.id }));
    }
  }

  private async openCategoryDialog(data: CategoryDialogData): Promise<CategoryDialogResult | undefined> {
    const ref = this.dialog.open<CategoryDialogComponent, CategoryDialogData, CategoryDialogResult>(
      CategoryDialogComponent,
      { data, width: '400px' },
    );
    return firstValueFrom(ref.afterClosed());
  }
}
