import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';

const retryCount = 2;
const baseRetryDelayMs = 750;
const maxRetryDelayMs = 3000;

export const apiRetryInterceptor: HttpInterceptorFn = (request, next) => {
  if (shouldSkipRetry(request.method, request.url)) {
    return next(request);
  }

  return next(request).pipe(
    retry({
      count: retryCount,
      delay: (error: unknown, retryAttempt: number) => {
        if (!shouldRetry(error)) {
          return throwError(() => error);
        }

        return timer(Math.min(baseRetryDelayMs * 2 ** (retryAttempt - 1), maxRetryDelayMs));
      },
    }),
  );
};

function shouldSkipRetry(method: string, url: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedUrl = url.toLowerCase();
  return normalizedMethod === 'POST'
    && (normalizedUrl.endsWith('/api/users') || normalizedUrl.includes('/api/notifications/telegram'));
}

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return true;
  }

  return error.status === 0
    || error.status === 408
    || error.status === 429
    || error.status >= 500;
}
