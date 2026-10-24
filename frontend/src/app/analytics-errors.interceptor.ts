import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AnalyticsService } from './analytics.service';

/** Observe final HTTP errors only; never inspect request or response bodies. */
export const analyticsErrorsInterceptor: HttpInterceptorFn = (request, next) => {
  const analytics = inject(AnalyticsService);
  return next(request).pipe(tap({ error: error => {
    if (error instanceof HttpErrorResponse && error.status >= 400 && error.status <= 599) {
      analytics.recordHttpError({ url: request.urlWithParams, method: request.method, status: error.status });
    }
  } }));
};
