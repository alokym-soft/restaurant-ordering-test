import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { OpenPriceDialogComponent, type OpenPriceDialogData, openPriceValidator } from './open-price-dialog.component';

describe('openPriceValidator', () => {
  const validate = (value: string) => openPriceValidator(500, 2000)(new FormControl(value, { nonNullable: true }));

  it('accepts amounts within the limits, including both ends', () => {
    expect(validate('5')).toBeNull();
    expect(validate('12.50')).toBeNull();
    expect(validate('12,50')).toEqual({ format: true });
    expect(validate('20.00')).toBeNull();
  });

  it('rejects malformed input and amounts outside the limits', () => {
    expect(validate('')).toEqual({ format: true });
    expect(validate('1.234')).toEqual({ format: true });
    expect(validate('-5')).toEqual({ format: true });
    expect(validate('4.99')).toEqual({ range: true });
    expect(validate('20.01')).toEqual({ range: true });
  });
});

describe('OpenPriceDialogComponent', () => {
  const close = vi.fn();

  async function render(data: OpenPriceDialogData) {
    close.mockReset();
    await TestBed.configureTestingModule({
      imports: [OpenPriceDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OpenPriceDialogComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function type(input: HTMLInputElement | null, value: string): void {
    if (!input) throw new Error('input not found');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('closes with the price in minor units and the quantity', async () => {
    const element = await render({ name: 'Tip', min: 0, max: 10000, quantity: 2 });
    type(element.querySelector('input[formcontrolname="price"]'), '12.5');
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(close).toHaveBeenCalledWith({ unitPrice: 1250, quantity: 2 });
  });

  it('does not close with an out-of-range price', async () => {
    const element = await render({ name: 'Tip', min: 1000, max: 2000, quantity: 1 });
    type(element.querySelector('input[formcontrolname="price"]'), '5');
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(close).not.toHaveBeenCalled();
  });
});
