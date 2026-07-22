import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';

import { appConfig } from './app.config';

describe('appConfig', () => {
  it('provides Angular service-worker update support', () => {
    TestBed.configureTestingModule({
      providers: appConfig.providers,
    });

    expect(TestBed.inject(SwUpdate)).toBeTruthy();
  });
});
