import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../commonServices/auth.service';

export interface LoginRequest {
  emailId: string;
  loginBy: 1 | 2;
  password?: string;
  otp?: string;
}

export interface LoginUser {
  id: number;
  code?: string | null;
  name: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  expires_at: string;
  user: LoginUser;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getRolesList() {
    return this.http.post(`${this.baseUrl}/check`, {}, {
      headers: this.authService.getAuthHeaders(),
    });
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
}
