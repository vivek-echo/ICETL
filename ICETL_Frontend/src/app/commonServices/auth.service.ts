import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { NavigationService } from './nav-item-service';

// =======================
// OLD LOGIN (OPTIONAL)
// =======================
export interface LoginPayload {
  emailId: string;
  password: string;
}

// =======================
// OTP LOGIN PAYLOAD
// =======================
export interface SendOtpPayload {
  emailId: string;
}

export interface VerifyOtpPayload {
  emailId: string;
  otp: string;
}

export interface CompleteProfilePayload {
  emailId: string;
  name: string;
  phone: string;
  dob: string;
  gender: string;
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

export interface VerifyOtpResponse<T> extends ApiResponse<T> {
  is_new_user?: boolean;
}

export interface SendOtpResponse extends ApiResponse<null> {
  otp?: number | string;
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
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
    menus?: unknown[];
    dashboard?: {
      dashboardName: string;
      dashboardUrl: string;
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiBaseUrl = environment.apiUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly NavigationService: NavigationService,
  ) {}

  // =======================
  // 🔐 PASSWORD LOGIN (OPTIONAL)
  // =======================
  login(payload: LoginPayload): Observable<ApiResponse<LoginData>> {
    return this.http
      .post<ApiResponse<LoginData>>(`${this.apiBaseUrl}/login`, payload)
      .pipe(tap((res) => this.handleAuthSuccess(res)));
  }

  // =======================
  // 📩 SEND OTP
  // =======================
  sendOtp(emailId: string): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(`${this.apiBaseUrl}/sendOtp`, { emailId });
  }

  // =======================
  // ✅ VERIFY OTP LOGIN
  // =======================
  verifyOtp(payload: VerifyOtpPayload): Observable<VerifyOtpResponse<LoginData>> {
    return this.http
      .post<VerifyOtpResponse<LoginData>>(`${this.apiBaseUrl}/verifyOtp`, payload)
      .pipe(tap((res) => this.handleAuthSuccess(res)));
  }

  // =======================
  // 🧾 COMPLETE PROFILE
  // =======================
  completeProfile(payload: CompleteProfilePayload): Observable<ApiResponse<LoginData>> {
    return this.http
      .post<ApiResponse<LoginData>>(`${this.apiBaseUrl}/completeProfile`, payload)
      .pipe(tap((res) => this.handleAuthSuccess(res)));
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
    const token = this.getToken();

    return new HttpHeaders(
      token
        ? {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          }
        : {
            Accept: 'application/json',
          },
    );
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
  logout() {
    return this.http.post(`${this.apiBaseUrl}/logout`, {},{
      headers: this.getAuthHeaders(),
    });
  }
}
