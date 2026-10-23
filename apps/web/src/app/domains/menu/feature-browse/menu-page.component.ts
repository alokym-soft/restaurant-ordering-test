import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-menu-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="page"><h1>Menu</h1></section>`,
  styles: `
    .page {
      padding: 24px;
    }
  `,
})
export class MenuPageComponent {}
