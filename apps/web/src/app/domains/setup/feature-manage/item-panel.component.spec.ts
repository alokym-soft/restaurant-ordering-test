import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import type { MenuItem } from '@restaurant/contracts';
import { NotificationService } from '@core/errors';
import { MenuApiActions, initialMenuState, menuFeature } from '@menu';
import { SetupPageActions, initialSetupState, itemKey, setupFeature } from '@setup/data-access';
import { ItemFormComponent } from '@setup/ui/item-form.component';
import { ITEM_REMOVED_MESSAGE, ItemPanelComponent } from './item-panel.component';

const soup = (version: number, name = 'Soup'): MenuItem => ({
  id: 'i1',
  categoryId: 'c1',
  name,
  pricing: { kind: 'fixed', price: 1000 },
  available: true,
  sortOrder: 0,
  version,
});

const menuWith = (...items: MenuItem[]) =>
  menuFeature.reducer(
    initialMenuState,
    MenuApiActions.snapshotLoaded({
      snapshot: { seq: 1, categories: [{ id: 'c1', name: 'Soups', sortOrder: 0, version: 1 }], items },
    }),
  );

async function render(itemId = 'i1', confirm = true) {
  const notified: string[] = [];
  const dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirm) }));
  await TestBed.configureTestingModule({
    imports: [ItemPanelComponent],
    providers: [
      provideMockStore({
        initialState: { [menuFeature.name]: menuWith(soup(1)), [setupFeature.name]: initialSetupState },
      }),
      { provide: NotificationService, useValue: { info: (m: string) => notified.push(m), error: () => {} } },
      { provide: MatDialog, useValue: { open: dialogOpen } },
    ],
  }).compileComponents();
  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(ItemPanelComponent);
  fixture.componentRef.setInput('itemId', itemId);
  const closed: (string | null)[] = [];
  fixture.componentInstance.closed.subscribe((id) => closed.push(id));
  await fixture.whenStable();
  const deleteButton = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Delete',
    );
  return { fixture, store, notified, closed, dialogOpen, deleteButton };
}

describe('ItemPanelComponent', () => {
  it('deletes the item after confirmation and closes without the "removed elsewhere" message', async () => {
    const { fixture, store, notified, closed, dialogOpen, deleteButton } = await render();
    const dispatch = vi.spyOn(store, 'dispatch');

    deleteButton()?.click();
    await fixture.whenStable();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(SetupPageActions.itemDeleteConfirmed({ id: 'i1' }));

    // The removal event arrives through the stream.
    store.setState({ [menuFeature.name]: menuWith(), [setupFeature.name]: initialSetupState });
    await fixture.whenStable();
    expect(notified).toEqual([]);
    expect(closed).toEqual(['i1']);
  });

  it('keeps the item when the confirmation is cancelled', async () => {
    const { fixture, store, deleteButton } = await render('i1', false);
    const dispatch = vi.spyOn(store, 'dispatch');
    deleteButton()?.click();
    await fixture.whenStable();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('stays open and allows another attempt when the delete fails', async () => {
    const { fixture, store, closed, deleteButton } = await render();
    deleteButton()?.click();
    await fixture.whenStable();
    const menu = menuWith(soup(1));
    store.setState({
      [menuFeature.name]: menu,
      [setupFeature.name]: { ...initialSetupState, inFlight: { [itemKey('i1')]: true } },
    });
    await fixture.whenStable();
    store.setState({
      [menuFeature.name]: menu,
      [setupFeature.name]: {
        ...initialSetupState,
        errors: { [itemKey('i1')]: { code: 'INTERNAL', message: 'Server down', status: 500 } },
      },
    });
    await fixture.whenStable();
    expect(closed).toEqual([]);
    expect(deleteButton()?.disabled).toBe(false);
  });

  it('offers no delete for a new item', async () => {
    const { deleteButton } = await render('new');
    expect(deleteButton()).toBeUndefined();
  });
  it('closes with a notification when the item is removed while open', async () => {
    const { fixture, store, notified, closed } = await render();
    store.setState({ [menuFeature.name]: menuWith(), [setupFeature.name]: initialSetupState });
    await fixture.whenStable();
    expect(notified).toEqual([ITEM_REMOVED_MESSAGE]);
    expect(closed).toEqual(['i1']);
  });

  it('loads the current version into the form after a version conflict', async () => {
    const { fixture, store, closed } = await render();
    const form = fixture.debugElement.query((el) => el.componentInstance instanceof ItemFormComponent)
      .componentInstance as ItemFormComponent;
    const load = vi.spyOn(form, 'load');
    form.save.emit({
      value: { categoryId: 'c1', name: 'Mine', description: '', pricing: soup(1).pricing, available: true },
      expectedVersion: 1,
    });
    const menu = menuWith(soup(1));
    store.setState({
      [menuFeature.name]: menu,
      [setupFeature.name]: { ...initialSetupState, inFlight: { [itemKey('i1')]: true } },
    });
    await fixture.whenStable();
    store.setState({
      [menuFeature.name]: menu,
      [setupFeature.name]: {
        ...initialSetupState,
        errors: {
          [itemKey('i1')]: {
            code: 'VERSION_CONFLICT',
            message: 'Conflict',
            status: 409,
            details: { current: soup(3, 'Theirs') },
          },
        },
      },
    });
    await fixture.whenStable();
    expect(load).toHaveBeenCalledWith(soup(3, 'Theirs'));
    expect(closed).toEqual([]);
  });
});
