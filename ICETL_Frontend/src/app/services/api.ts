import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  login: string;
  loginBy: 1 | 2;
  password?: string;
  otp?: string;
}

export interface LoginUser {
  id: number;
  name: string;
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

  constructor(private http: HttpClient) {}

  getRolesList() {
    return this.http.post(`${this.baseUrl}/check`, {});
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
}
