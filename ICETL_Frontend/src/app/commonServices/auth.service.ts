import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { NavigationService } from './nav-item-service';
import { isPlatformBrowser } from '@angular/common';

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

export interface SelectRolePayload {
  flowToken: string;
  user_id: number;
}

export interface CompleteProfilePayload {
  flowToken: string;
  name: string;
  phone: string;
  dob: string;
  gender: string;
}

// =======================
// COMMON RESPONSE
// =======================
export interface ApiResponse<T> {
  success?: boolean;
  status?: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface RoleSelectionOption {
  user_id: number;
  role_id: number;
  role_name: string;
  dashboard_url: string;
  profile_img?: string | null;
}

export interface VerifyOtpResponse<T> extends ApiResponse<T> {
  is_new_user?: boolean;
  is_multi_role_user?: boolean;
  requiresRoleSelection?: boolean;
  requiresProfileCompletion?: boolean;
  flowToken?: string;
  roles?: RoleSelectionOption[];
}

export interface SendOtpResponse extends ApiResponse<null> {
  expiresIn?: number;
  resendAfter?: number;
  otp?: string;
}

// =======================
// LOGIN DATA
// =======================
export interface LoginData {
  token: string;
  expires_at?: string;
  user: {
    id: number;
    code?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
    profileImg?: string | null;
    thumbnailImg?: string | null;
    coverImg?: string | null;
    profileImgUrl?: string | null;
    thumbnailImgUrl?: string | null;
    coverImgUrl?: string | null;
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
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly isBrowser: boolean;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly NavigationService: NavigationService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.scheduleStoredTokenExpiry();
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

  selectRole(payload: SelectRolePayload): Observable<ApiResponse<LoginData>> {
    return this.http
      .post<ApiResponse<LoginData>>(`${this.apiBaseUrl}/selectRole`, payload)
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

  storeSession(data: LoginData): void {
    this.persistAuthSession(data);
  }

  // =======================
  // 💾 HANDLE LOGIN SUCCESS
  // =======================
  private handleAuthSuccess(response: ApiResponse<LoginData>) {
    if ((response.success || response.status) && response.data && this.isBrowser) {
      this.persistAuthSession(response.data);
    }
  }

  private persistAuthSession(data: LoginData): void {
    if (!this.isBrowser) {
      return;
    }

    const user = data.user;

    localStorage.setItem('auth_token', data.token);
    if (data.expires_at) {
      localStorage.setItem('auth_expires_at', data.expires_at);
    } else {
      localStorage.removeItem('auth_expires_at');
    }

    localStorage.setItem('auth_user', JSON.stringify(user));

    if (Array.isArray(user.menus)) {
      localStorage.setItem('menus', JSON.stringify(user.menus));
    } else {
      localStorage.removeItem('menus');
    }

    if (user.dashboard) {
      localStorage.setItem('dashboardsetting', JSON.stringify(user.dashboard));
    } else {
      localStorage.removeItem('dashboardsetting');
    }

    this.NavigationService.loadNavigation();
    this.scheduleStoredTokenExpiry();
    window.dispatchEvent(new Event('auth-user-updated'));
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

  updateStoredUser(userPatch: Record<string, unknown>): void {
    if (!this.isBrowser) {
      return;
    }

    const currentUser = this.getUser();
    const nextUser = { ...currentUser, ...userPatch };

    localStorage.setItem('auth_user', JSON.stringify(nextUser));

    if (Array.isArray(nextUser.menus)) {
      localStorage.setItem('menus', JSON.stringify(nextUser.menus));
    }

    window.dispatchEvent(new Event('auth-user-updated'));
  }

  // =======================
  // ✅ CHECK LOGIN
  // =======================
  isLoggedIn(): boolean {
    if (!this.getToken()) {
      return false;
    }

    if (this.isTokenExpired()) {
      this.logoutLocally(true);
      return false;
    }

    return true;
  }

  // =======================
  // 🚪 LOGOUT
  // =======================
  logout() {
    return this.http.post(`${this.apiBaseUrl}/logout`, {},{
      headers: this.getAuthHeaders(),
    });
  }

  logoutLocally(redirectToLogin = true): void {
    if (!this.isBrowser) {
      return;
    }

    this.clearExpiryTimer();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_expires_at');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('dashboardsetting');
    localStorage.removeItem('menus');
    this.NavigationService.loadNavigation();
    window.dispatchEvent(new Event('auth-session-cleared'));

    if (redirectToLogin) {
      void this.router.navigate(['/login']);
    }
  }

  private scheduleStoredTokenExpiry(): void {
    if (!this.isBrowser) {
      return;
    }

    this.clearExpiryTimer();

    const expiresAt = this.getTokenExpiryTime();
    if (!expiresAt) {
      return;
    }

    const delay = expiresAt - Date.now();

    if (delay <= 0) {
      this.logoutLocally(true);
      return;
    }

    this.expiryTimer = setTimeout(() => this.logoutLocally(true), Math.min(delay, 2147483647));
  }

  private getTokenExpiryTime(): number | null {
    const expiresAt = localStorage.getItem('auth_expires_at');

    if (!expiresAt) {
      return null;
    }

    const expiryTime = new Date(expiresAt).getTime();

    return Number.isNaN(expiryTime) ? null : expiryTime;
  }

  private isTokenExpired(): boolean {
    const expiryTime = this.getTokenExpiryTime();

    return expiryTime !== null && expiryTime <= Date.now();
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }
}
