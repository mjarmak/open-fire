import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AnalyticsService } from './analytics.service';
import { analyticsErrorsInterceptor } from './analytics-errors.interceptor';

describe('optional HTTP error logging', () => {
  it('records only final 4xx/5xx metadata while preserving the original request and error', () => {
    const recorded: unknown[] = [];
    TestBed.configureTestingModule({providers: [{provide: AnalyticsService, useValue: {recordHttpError: (value: unknown) => recorded.push(value)}}]});
    const request = new HttpRequest('POST', '/api/orders?private=query', {private: 'body'});
    for (const status of [0, 400, 401, 404, 500, 599]) {
      const original = new HttpErrorResponse({status, error: {private: 'response'}});
      TestBed.runInInjectionContext(() => analyticsErrorsInterceptor(request, forwarded => {
        expect(forwarded).toBe(request);
        return throwError(() => original);
      })).subscribe({error: error => expect(error).toBe(original)});
    }
    const response = new HttpResponse({status: 200, body: {private: 'success'}});
    TestBed.runInInjectionContext(() => analyticsErrorsInterceptor(request, () => of(response)))
      .subscribe(value => expect(value).toBe(response));
    expect(recorded).toEqual([400,401,404,500,599].map(status => ({url: '/api/orders?private=query', method: 'POST', status})));
    TestBed.resetTestingModule();
  });
});
