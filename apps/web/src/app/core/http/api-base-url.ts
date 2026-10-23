import { InjectionToken, inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';

/**
 * Prefix for API requests. Empty by default: the app and the API share an origin
 * (the dev server proxies `/api`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { factory: () => '' });

/** Prefixes root-relative `/api/...` URLs with {@link API_BASE_URL}. */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (!base || !req.url.startsWith('/api/')) return next(req);
  return next(req.clone({ url: base.replace(/\/$/, '') + req.url }));
};
