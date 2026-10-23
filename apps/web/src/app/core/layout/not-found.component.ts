import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <a mat-flat-button routerLink="/menu">Go to the menu</a>
    </section>
  `,
  styles: `
    .page {
      padding: 24px;
    }
  `,
})
export class NotFoundComponent {}
