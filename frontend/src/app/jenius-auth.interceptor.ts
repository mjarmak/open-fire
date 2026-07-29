import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, EMPTY, switchMap, throwError } from 'rxjs';
import { JeniusAuthService } from './jenius-auth.service';

export const jeniusAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api')) return next(request);
  const auth = inject(JeniusAuthService);
  const token = auth.getAccessToken();
  if (!token) {
    auth.retryAuthorization();
    return EMPTY;
  }

  const send = (accessToken: string) => next(request.clone({
    setHeaders: { Authorization: `Bearer ${accessToken}` },
  }));
  const request$ = auth.isAccessTokenExpiring()
    ? auth.refreshAccessToken().pipe(switchMap(() => {
        const refreshed = auth.getAccessToken();
        return refreshed ? send(refreshed) : EMPTY;
      }))
    : send(token);

  return request$.pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
      return throwError(() => error);
    }
    return auth.refreshAccessToken().pipe(
      switchMap(() => {
        const refreshed = auth.getAccessToken();
        return refreshed ? send(refreshed) : EMPTY;
      }),
      catchError((refreshError) => {
        auth.retryAuthorization();
        return throwError(() => refreshError);
      }),
    );
  }));
};
