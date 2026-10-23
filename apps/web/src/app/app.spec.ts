import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { connectionFeature, initialConnectionState } from '@core/realtime';
import { cartFeature, initialCartState } from '@cart';
import { initialMenuState, menuFeature } from '@menu';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            [connectionFeature.name]: initialConnectionState,
            [cartFeature.name]: initialCartState,
            [menuFeature.name]: initialMenuState,
          },
        }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the shell with navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Restaurant');
    const links = Array.from(compiled.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Menu', 'Orders', 'Setup']);
  });
});
