import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../commonServices/auth.service';

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
}
