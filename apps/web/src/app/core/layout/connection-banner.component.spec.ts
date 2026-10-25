import { TestBed } from '@angular/core/testing';
import type { ConnectionStatus } from '@core/realtime';
import { ConnectionBannerComponent } from './connection-banner.component';

describe('ConnectionBannerComponent', () => {
  function render(status: ConnectionStatus) {
    const fixture = TestBed.createComponent(ConnectionBannerComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = [...element.querySelectorAll('button')];
    return { fixture, element, banner: element.querySelector('.banner'), buttons };
  }

  it.each<ConnectionStatus>(['connecting', 'online'])('shows nothing while %s', (status) => {
    expect(render(status).banner).toBeNull();
  });

  it('offline: explains that ordering is paused, without actions', () => {
    const { banner, buttons } = render('offline');
    expect(banner?.textContent).toContain('You are offline');
    expect(banner?.getAttribute('aria-live')).toBe('polite');
    expect(buttons).toHaveLength(0);
  });

  it('reconnecting: offers "Retry now", which emits retry', () => {
    const { fixture, banner, buttons } = render('reconnecting');
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    expect(banner?.textContent).toContain('Reconnecting');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Retry now']);
    buttons[0]?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('error: shows the error style and a "Reload" action, which emits reload', () => {
    const { fixture, banner, buttons } = render('error');
    const reload = vi.fn();
    fixture.componentInstance.reload.subscribe(reload);

    expect(banner?.classList).toContain('banner--error');
    expect(banner?.textContent).toContain('Live updates are unavailable');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Reload']);
    buttons[0]?.click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
