import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { MenuItem } from '@restaurant/contracts';
import { NotificationService } from '@core/errors';
import { MenuApiActions, initialMenuState, menuFeature } from '@menu';
import { initialSetupState, itemKey, setupFeature } from '@setup/data-access';
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

async function render() {
  const notified: string[] = [];
  await TestBed.configureTestingModule({
    imports: [ItemPanelComponent],
    providers: [
      provideMockStore({
        initialState: { [menuFeature.name]: menuWith(soup(1)), [setupFeature.name]: initialSetupState },
      }),
      { provide: NotificationService, useValue: { info: (m: string) => notified.push(m), error: () => {} } },
    ],
  }).compileComponents();
  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(ItemPanelComponent);
  fixture.componentRef.setInput('itemId', 'i1');
  const closed: (string | null)[] = [];
  fixture.componentInstance.closed.subscribe((id) => closed.push(id));
  await fixture.whenStable();
  return { fixture, store, notified, closed };
}

describe('ItemPanelComponent', () => {
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
