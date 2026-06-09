import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CertificateService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  generateCertificate(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/certificates/generate`, payload);
  }
}