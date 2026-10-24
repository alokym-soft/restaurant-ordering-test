import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatMoney } from '@shared/util/money';
import {
  type MenuChangesDialogData,
  MenuChangesDialogComponent,
  describeOutcome,
} from './menu-changes-dialog.component';

describe('describeOutcome', () => {
  it('states exactly what happens to each line', () => {
    expect(describeOutcome({ kind: 'reprice', from: 1000, to: 1200 })).toBe(
      `Price ${formatMoney(1000)} → ${formatMoney(1200)}`,
    );
    expect(describeOutcome({ kind: 'remove', reason: 'unavailable' })).toBe('Will be removed (unavailable)');
    expect(describeOutcome({ kind: 'remove', reason: 'removed' })).toBe('Will be removed (no longer on the menu)');
    expect(describeOutcome({ kind: 'remove', reason: 'out_of_range', min: 500, max: 900 })).toBe(
      `Will be removed (price out of allowed range ${formatMoney(500)} – ${formatMoney(900)})`,
    );
  });
});

describe('MenuChangesDialogComponent', () => {
  async function render(data: MenuChangesDialogData): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [MenuChangesDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
    }).compileComponents();
    const fixture = TestBed.createComponent(MenuChangesDialogComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists every affected line with its outcome', async () => {
    const element = await render({
      rows: [
        { lineId: 'a', name: 'Soup', quantity: 2, outcome: { kind: 'reprice', from: 1000, to: 1200 } },
        { lineId: 'b', name: 'Tea', quantity: 1, outcome: { kind: 'remove', reason: 'unavailable' } },
      ],
      cartWillBeEmpty: false,
    });
    const rows = Array.from(element.querySelectorAll('.row')).map((row) => [
      row.querySelector('.name')?.textContent?.trim(),
      row.querySelector('.outcome')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['2 × Soup', `Price ${formatMoney(1000)} → ${formatMoney(1200)}`],
      ['1 × Tea', 'Will be removed (unavailable)'],
    ]);
    expect(element.textContent).toContain('Accept and place order');
  });

  it('warns when accepting empties the cart', async () => {
    const element = await render({
      rows: [{ lineId: 'b', name: 'Tea', quantity: 1, outcome: { kind: 'remove', reason: 'removed' } }],
      cartWillBeEmpty: true,
    });
    expect(element.textContent).toContain('Your cart will be empty');
    expect(element.textContent).not.toContain('Accept and place order');
  });
});
