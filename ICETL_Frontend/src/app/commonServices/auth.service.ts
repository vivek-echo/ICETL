import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

// =======================
// OLD LOGIN (OPTIONAL)
// =======================
export interface LoginPayload {
  email: string;
  password: string;
}

// =======================
// OTP LOGIN PAYLOAD
// =======================
export interface SendOtpPayload {
  user: string; // email or phone
}

export interface VerifyOtpPayload {
  user: string;
  otp: string;
}

export interface CompleteProfilePayload {
  user: string;
  name: string;
  email: string;
}

// =======================
// COMMON RESPONSE
// =======================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// =======================
// LOGIN DATA
// =======================
export interface LoginData {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly apiBaseUrl = environment.apiUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  // =======================
  // 🔐 PASSWORD LOGIN (OPTIONAL)
  // =======================
  login(payload: LoginPayload): Observable<ApiResponse<LoginData>> {
    return this.http.post<ApiResponse<LoginData>>(
      `${this.apiBaseUrl}/login`,
      payload
    ).pipe(
      tap(res => this.handleAuthSuccess(res))
    );
  }

  // =======================
  // 📩 SEND OTP
  // =======================
  sendOtp(user: string): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(
      `${this.apiBaseUrl}/sendOtp`,
      { user }
    );
  }

  // =======================
  // ✅ VERIFY OTP LOGIN
  // =======================
  verifyOtp(payload: VerifyOtpPayload): Observable<ApiResponse<LoginData>> {
    return this.http.post<ApiResponse<LoginData>>(
      `${this.apiBaseUrl}/verifyOtp`,
      payload
    ).pipe(
      tap(res => this.handleAuthSuccess(res))
    );
  }

  // =======================
  // 🧾 COMPLETE PROFILE
  // =======================
  completeProfile(payload: CompleteProfilePayload): Observable<ApiResponse<LoginData>> {
    return this.http.post<ApiResponse<LoginData>>(
      `${this.apiBaseUrl}/completeProfile`,
      payload
    ).pipe(
      tap(res => this.handleAuthSuccess(res))
    );
  }

  // =======================
  // 💾 HANDLE LOGIN SUCCESS
  // =======================
  private handleAuthSuccess(response: ApiResponse<LoginData>) {
    if (response.success && response.data) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('auth_user', JSON.stringify(response.data.user));
    }
  }

  // =======================
  // 🔑 GET TOKEN
  // =======================
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // =======================
  // 📦 AUTH HEADERS
  // =======================
  getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`
    });
  }

  // =======================
  // 👤 GET USER
  // =======================
  getUser() {
    return JSON.parse(localStorage.getItem('auth_user') || '{}');
  }

  // =======================
  // ✅ CHECK LOGIN
  // =======================
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // =======================
  // 🚪 LOGOUT
  // =======================
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    void this.router.navigate(['/login']);
  }
}
