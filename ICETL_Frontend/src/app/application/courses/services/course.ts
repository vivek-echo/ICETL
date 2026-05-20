import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class Course {
  public API_URL = environment.apiUrl;
  public PRE_LOGIN_API_URL = environment.preLoginApi;
  constructor(private http: HttpClient) {}

  addCourseCategory(formData: any): any {
    return this.http.post(`${this.API_URL}/addCourseCategory`, formData, {});
  }

  getCourseCategories(payload: any): any {
    return this.http.post(`${this.API_URL}/getCourseCategories`, payload, {});
  }
  getCourseCategoriesPreLogin(payload: any): any {
    return this.http.post(`${this.PRE_LOGIN_API_URL}/getCourseCategories`, payload, {});
  }

  updateCourseCategory(formData: any): any {
    return this.http.post(`${this.API_URL}/updateCourseCategory`, formData, {});
  }

  deleteCourseCategory(payload: any): any {
    return this.http.post(`${this.API_URL}/deleteCourseCategory`, payload, {});
  }
  getInstructorListByInstructorId(payload: any): any {
    return this.http.post(`${this.API_URL}/getInstructorListByInstructorId`, payload, {});
  }
  createCourse(payload: any): any {
    return this.http.post(`${this.API_URL}/createCourse`, payload, {});
  }
}
