import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="page"><h1>Orders</h1></section>`,
  styles: `
    .page {
      padding: 24px;
    }
  `,
})
export class OrdersPageComponent {}
