import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class Course {
  public API_URL = environment.apiUrl;
  constructor(private http: HttpClient) {}


  addCourseCategory(formData: any): any {
    return this.http.post(`${this.API_URL}/addCourseCategory`, formData, {
      //  headers: this.authService.getAuthHeaders(),
     });
  }

  getCourseCategories(payload: any): any {
    return this.http.post(`${this.API_URL}/getCourseCategories`, payload, {
      //  headers: this.authService.getAuthHeaders(),
     });
  }

  updateCourseCategory(formData: any): any {
    return this.http.post(`${this.API_URL}/updateCourseCategory`, formData, {
      //  headers: this.authService.getAuthHeaders(),
     });
  }

  deleteCourseCategory(payload: any): any {
    return this.http.post(`${this.API_URL}/deleteCourseCategory`, payload, {
      //  headers: this.authService.getAuthHeaders(),
     });
  }
}
