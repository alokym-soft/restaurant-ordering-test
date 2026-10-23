import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { ShellComponent } from '@core/layout';
import { selectCartCount } from '@cart';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly cartCount = inject(Store).selectSignal(selectCartCount);
}
