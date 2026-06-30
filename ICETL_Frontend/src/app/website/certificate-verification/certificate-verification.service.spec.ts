import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { CertificateVerificationService } from './certificate-verification.service';

describe('CertificateVerificationService', () => {
  let service: CertificateVerificationService;
  let httpMock: HttpTestingController;

  beforeAll(() => {
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch (error) {
      if (!String(error).includes('Cannot set base providers')) {
        throw error;
      }
    }
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CertificateVerificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
  });

  it('should call the public verification endpoint with an encoded code', () => {
    const verificationCode = 'abc/def 123';

    service.verifyCertificate(verificationCode).subscribe((response) => {
      expect(response.success).toBe(false);
      expect(response.data.isValid).toBe(false);
    });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/public/certificates/verify/${encodeURIComponent(verificationCode)}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      success: false,
      message: 'Certificate not found or verification code is invalid.',
      data: {
        isValid: false,
      },
    });
  });
});
