import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CertificateVerificationData {
  isValid: boolean;
  certificateNo?: string | null;
  studentName?: string | null;
  moduleType?: string | null;
  moduleTypeLabel?: string | null;
  moduleTitle?: string | null;
  courseCategory?: string | null;
  durationText?: string | null;
  grade?: string | null;
  issueDate?: string | null;
  completionDate?: string | null;
  verificationCode?: string | null;
  status?: string | null;
}

export interface CertificateVerificationResponse {
  success: boolean;
  message: string;
  data: CertificateVerificationData;
}

@Injectable({
  providedIn: 'root',
})
export class CertificateVerificationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  verifyCertificate(verificationCode: string): Observable<CertificateVerificationResponse> {
    const encodedCode = encodeURIComponent(verificationCode);

    return this.http.get<CertificateVerificationResponse>(
      `${this.apiUrl}/public/certificates/verify/${encodedCode}`,
    );
  }
}
