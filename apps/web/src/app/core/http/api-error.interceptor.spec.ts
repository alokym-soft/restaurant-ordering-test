import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiBaseUrlInterceptor } from './api-base-url';
import { HTTP_TIMEOUT_MS, apiErrorInterceptor } from './api-error.interceptor';
import { NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from './http-api-error';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  const failure = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('expected the request to fail');
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: HTTP_TIMEOUT_MS, useValue: 1_000 },
        { provide: API_BASE_URL, useValue: 'http://api.test/' },
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.useRealTimers());

  it('prefixes API URLs with the base URL', async () => {
    const result = firstValueFrom(http.get('/api/menu'));
    controller.expectOne('http://api.test/api/menu').flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('keeps an ApiError body and adds the status', async () => {
    const result = failure(firstValueFrom(http.post('/api/orders', {})));
    controller
      .expectOne('http://api.test/api/orders')
      .flush(
        { code: 'MENU_CHANGED', message: 'Menu changed', details: { changes: [], items: [] } },
        { status: 409, statusText: 'Conflict' },
      );
    expect(await result).toEqual({
      code: 'MENU_CHANGED',
      message: 'Menu changed',
      details: { changes: [], items: [] },
      status: 409,
    });
  });

  it('normalizes a 5xx without an ApiError body', async () => {
    const result = failure(firstValueFrom(http.get('/api/menu')));
    controller.expectOne('http://api.test/api/menu').flush('<html>', { status: 502, statusText: 'Bad Gateway' });
    expect(await result).toEqual({ code: 'INTERNAL', message: SERVER_ERROR_MESSAGE, status: 502 });
  });

  it('normalizes a network error', async () => {
    const result = failure(firstValueFrom(http.get('/api/menu')));
    controller.expectOne('http://api.test/api/menu').error(new ProgressEvent('error'), { status: 0 });
    expect(await result).toEqual({ code: 'INTERNAL', message: NETWORK_ERROR_MESSAGE, status: 0 });
  });

  it('normalizes a timeout', async () => {
    vi.useFakeTimers();
    const result = failure(firstValueFrom(http.get('/api/menu')));
    vi.advanceTimersByTime(1_000);
    expect(await result).toEqual({ code: 'INTERNAL', message: TIMEOUT_ERROR_MESSAGE, status: 0 });
  });
});
