import { TestBed } from '@angular/core/testing';
import { UNKNOWN_ERROR_MESSAGE } from '@core/http';
import { GlobalErrorHandler } from './global-error-handler';
import { NotificationService } from './notification.service';

describe('GlobalErrorHandler', () => {
  let notify: ReturnType<typeof vi.fn>;
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notify = vi.fn();
    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler, { provide: NotificationService, useValue: { error: notify } }],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('logs the error and shows a generic message, never the error text', () => {
    const error = new Error('TypeError: cannot read x of undefined at foo.ts:12');
    handler.handleError(error);

    expect(console.error).toHaveBeenCalledWith(error);
    expect(notify).toHaveBeenCalledWith(UNKNOWN_ERROR_MESSAGE);
  });

  it('shows the safe message of an unhandled API error', () => {
    handler.handleError({ code: 'INTERNAL', message: 'Something went wrong on our side.', status: 500 });
    expect(notify).toHaveBeenCalledWith('Something went wrong on our side.');
  });

  it('does not throw when the notification itself fails', () => {
    notify.mockImplementation(() => {
      throw new Error('overlay not ready');
    });
    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});
