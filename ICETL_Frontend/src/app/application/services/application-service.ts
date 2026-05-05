import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../commonServices/auth.service';

@Injectable({
  providedIn: 'root',
})
export class ApplicationService {
  private readonly apiBaseUrl = environment.apiUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}
  check(){
     return this.http.post(`${this.apiBaseUrl}/check`, {}, {
       headers: this.authService.getAuthHeaders(),
     });
  }
}
