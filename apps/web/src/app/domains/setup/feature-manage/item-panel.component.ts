import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import type { CategoryId, ItemId, MenuItem } from '@restaurant/contracts';
import { NotificationService } from '@core/errors';
import { menuFeature, selectItemEntities } from '@menu';
import {
  NEW_ITEM_KEY,
  SetupPageActions,
  itemKey,
  selectSetupCategories,
  setupFeature,
} from '@setup/data-access';
import { type ItemFormSave, ItemFormComponent } from '@setup/ui/item-form.component';

export const NEW_ITEM_ID = 'new';
export const ITEM_REMOVED_MESSAGE = 'This item was removed elsewhere.';

/**
 * Side panel for creating or editing an item, driven by `?item=`. It feeds the latest item from the
 * store into the form, closes after a successful save, refreshes the form after a version conflict,
 * and closes if the item is removed while open.
 */
@Component({
  selector: 'app-item-panel',
  imports: [MatButtonModule, ItemFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'false',
    '[attr.aria-label]': 'title()',
    tabindex: '-1',
    '(keydown.escape)': 'close()',
  },
  template: `
    <header class="head">
      <h2>{{ title() }}</h2>
      <button mat-button type="button" aria-label="Close" (click)="close()">Close</button>
    </header>
    <app-item-form
      [item]="item()"
      [categories]="categories()"
      [defaultCategoryId]="categoryId()"
      [saving]="saving()"
      (save)="save($event)"
      (cancelled)="close()"
    />
  `,
  styles: `
    :host {
      display: block;
      flex: 0 0 400px;
      overflow: auto;
      padding: 0 var(--space-4) var(--space-4);
      box-sizing: border-box;
      border-left: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface);
      outline: none;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .head h2 {
      font: var(--mat-sys-title-medium);
    }
    /* Medium screens: overlay the list instead of squeezing it to nothing. */
    @media (min-width: 721px) and (max-width: 1100px) {
      :host {
        position: absolute;
        inset-block: 0;
        right: 0;
        width: 400px;
        max-width: 100%;
        z-index: 5;
        box-shadow: var(--mat-sys-level3);
      }
    }
    @media (max-width: 720px) {
      :host {
        position: fixed;
        inset: 0;
        z-index: 10;
        border-left: 0;
      }
    }
  `,
})
export class ItemPanelComponent {
  private readonly store = inject(Store);
  private readonly notifications = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly form = viewChild.required(ItemFormComponent);

  /** Item id, or `new`. */
  readonly itemId = input.required<string>();
  /** Category preselected for a new item. */
  readonly categoryId = input<CategoryId | null>(null);
  /** Emits the id of the edited item (to return focus to its row), or `null` for a new item. */
  readonly closed = output<ItemId | null>();

  private readonly entities = this.store.selectSignal(selectItemEntities);
  private readonly menuStatus = this.store.selectSignal(menuFeature.selectStatus);
  private readonly inFlight = this.store.selectSignal(setupFeature.selectInFlight);
  private readonly errors = this.store.selectSignal(setupFeature.selectErrors);
  protected readonly categories = this.store.selectSignal(selectSetupCategories);

  protected readonly isNew = computed(() => this.itemId() === NEW_ITEM_ID);
  protected readonly item = computed((): MenuItem | null =>
    this.isNew() ? null : (this.entities()[this.itemId()] ?? null),
  );
  private readonly key = computed(() => (this.isNew() ? NEW_ITEM_KEY : itemKey(this.itemId())));
  protected readonly saving = computed(() => this.inFlight()[this.key()] === true);
  protected readonly title = computed(() => (this.isNew() ? 'New item' : 'Edit item'));

  private awaitingResult = false;
  private isClosing = false;

  constructor() {
    afterNextRender(() => this.host.nativeElement.focus());

    // Closes when the edited item disappears from the menu (deleted elsewhere or unknown id).
    effect(() => {
      if (this.isNew() || this.item() || this.menuStatus() !== 'loaded') return;
      untracked(() => {
        this.notifications.info(ITEM_REMOVED_MESSAGE);
        this.close();
      });
    });

    // Reacts to the end of a save: close on success, show the latest version on a conflict.
    effect(() => {
      if (this.saving() || !this.awaitingResult) return;
      untracked(() => {
        this.awaitingResult = false;
        const error = this.errors()[this.key()];
        if (!error) {
          this.close();
        } else if (error.code === 'VERSION_CONFLICT') {
          const current = (error.details as { current?: MenuItem } | undefined)?.current;
          if (current) this.form().load(current);
        }
      });
    });
  }

  protected save({ value, expectedVersion }: ItemFormSave): void {
    this.awaitingResult = true;
    const { description, ...rest } = value;
    if (this.isNew() || expectedVersion === null) {
      this.store.dispatch(
        SetupPageActions.itemCreated({ request: description ? { ...rest, description } : rest }),
      );
    } else {
      this.store.dispatch(
        SetupPageActions.itemUpdated({ id: this.itemId(), request: { ...rest, description, expectedVersion } }),
      );
    }
  }

  protected close(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.closed.emit(this.isNew() ? null : this.itemId());
  }
}
