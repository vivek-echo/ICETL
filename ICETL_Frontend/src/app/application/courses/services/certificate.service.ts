import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CertificateHistoryItem {
  id: number;
  certificateNo?: string | null;
  moduleType?: string | null;
  moduleId: number;
  moduleTitle?: string | null;
  issueDate?: string | null;
  verificationUrl?: string | null;
  downloadAvailable: boolean;
  downloadUrl?: string | null;
  verificationStatus?: string | null;
  status?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CertificateService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  generateCertificate(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/certificates/generate`, payload);
  }

  downloadCertificateFile(downloadUrl: string) {
    return this.http.get(downloadUrl, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  getCertificateHistory(limit = 50): Observable<{
    success: boolean;
    message: string;
    data: { items: CertificateHistoryItem[] };
  }> {
    return this.http.get<{
      success: boolean;
      message: string;
      data: { items: CertificateHistoryItem[] };
    }>(`${this.apiUrl}/workflow/certificates`, {
      params: { limit },
    });
  }
}
