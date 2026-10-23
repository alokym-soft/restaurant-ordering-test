import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { NotificationService } from '@core/errors';
import { ErrorStateComponent } from '@shared/ui';
import {
  MenuPageActions,
  type MenuRow,
  menuFeature,
  selectCategoryNav,
  selectItemEntities,
  selectMenuIsEmptyLoading,
  selectMenuRows,
} from '@menu/data-access';
import { MENU_ROW_HEIGHT } from '@menu/ui/menu-row-height';
import { type MenuItemAdd, MenuItemRowComponent } from '@menu/ui/menu-item-row.component';
import { MenuSkeletonRowComponent } from '@menu/ui/menu-skeleton-row.component';

@Component({
  selector: 'app-menu-page',
  imports: [ScrollingModule, MatButtonModule, ErrorStateComponent, MenuItemRowComponent, MenuSkeletonRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-page.component.html',
  styleUrl: './menu-page.component.scss',
})
export class MenuPageComponent {
  private readonly store = inject(Store);
  private readonly notifications = inject(NotificationService);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly rowHeight = MENU_ROW_HEIGHT;
  protected readonly skeletons = Array.from({ length: 12 }, (_, index) => index);

  protected readonly rows = this.store.selectSignal(selectMenuRows);
  protected readonly items = this.store.selectSignal(selectItemEntities);
  protected readonly categories = this.store.selectSignal(selectCategoryNav);
  protected readonly status = this.store.selectSignal(menuFeature.selectStatus);
  protected readonly error = this.store.selectSignal(menuFeature.selectError);
  protected readonly showSkeleton = this.store.selectSignal(selectMenuIsEmptyLoading);
  protected readonly hasRows = computed(() => this.rows().length > 0);

  protected readonly trackRow = (_index: number, row: MenuRow): string => `${row.kind}:${row.id}`;

  protected scrollToCategory(rowIndex: number): void {
    this.viewport()?.scrollToIndex(rowIndex, 'smooth');
  }

  protected retry(): void {
    this.store.dispatch(MenuPageActions.retryClicked());
  }

  protected add({ item, quantity }: MenuItemAdd): void {
    if (item.pricing.kind !== 'fixed') return;
    this.store.dispatch(
      MenuPageActions.itemAdded({
        itemId: item.id,
        name: item.name,
        priceKind: 'fixed',
        unitPrice: item.pricing.price,
        itemVersion: item.version,
        quantity,
      }),
    );
    this.notifications.info(`${quantity} × ${item.name} added to cart`);
  }
}
