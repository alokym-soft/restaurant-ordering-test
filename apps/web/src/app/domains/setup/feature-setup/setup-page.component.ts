import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="page"><h1>Setup</h1></section>`,
  styles: `
    .page {
      padding: 24px;
    }
  `,
})
export class SetupPageComponent {}
