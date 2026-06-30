import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CertificateVerificationData,
  CertificateVerificationResponse,
  CertificateVerificationService,
} from './certificate-verification.service';

type VerificationState = 'loading' | 'valid' | 'invalid' | 'error';

@Component({
  selector: 'app-certificate-verification',
  imports: [RouterLink],
  templateUrl: './certificate-verification.component.html',
  styleUrl: './certificate-verification.component.scss',
})
export class CertificateVerificationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly certificateVerificationService = inject(CertificateVerificationService);

  readonly state = signal<VerificationState>('loading');
  readonly certificate = signal<CertificateVerificationData | null>(null);
  readonly verificationCode = signal('');
  readonly message = signal('Checking certificate details...');

  ngOnInit(): void {
    const code = (this.route.snapshot.paramMap.get('verificationCode') || '').trim();

    this.verificationCode.set(code);

    if (!this.isValidVerificationCode(code)) {
      this.showInvalidResult('The certificate code is invalid, expired, revoked, or unavailable.');
      return;
    }

    this.verifyCertificate(code);
  }

  displayValue(value: string | null | undefined): string {
    const normalizedValue = (value || '').trim();

    return normalizedValue || 'Not Available';
  }

  private verifyCertificate(code: string): void {
    this.state.set('loading');
    this.message.set('Checking certificate details...');
    this.certificate.set(null);

    this.certificateVerificationService
      .verifyCertificate(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.handleVerificationResponse(response),
        error: (error: HttpErrorResponse) => this.handleVerificationError(error),
      });
  }

  private handleVerificationResponse(response: CertificateVerificationResponse): void {
    if (response.success && response.data?.isValid) {
      this.certificate.set(response.data);
      this.message.set(response.message || 'Certificate verified successfully.');
      this.state.set('valid');
      return;
    }

    this.showInvalidResult(response.message);
  }

  private handleVerificationError(error: HttpErrorResponse): void {
    const response = error.error as CertificateVerificationResponse | undefined;

    if (error.status === 404 || response?.data?.isValid === false) {
      this.showInvalidResult(response?.message);
      return;
    }

    this.certificate.set(null);
    this.message.set('Unable to verify this certificate right now. Please try again later.');
    this.state.set('error');
  }

  private showInvalidResult(message?: string): void {
    this.certificate.set(null);
    this.message.set(
      message || 'The certificate code is invalid, expired, revoked, or unavailable.',
    );
    this.state.set('invalid');
  }

  private isValidVerificationCode(code: string): boolean {
    return /^[A-Za-z0-9-]{20,120}$/.test(code);
  }
}
