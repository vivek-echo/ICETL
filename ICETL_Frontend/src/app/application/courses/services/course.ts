import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PublicCourseInstructor {
  id: number;
  name: string;
}

export interface PublicCourseApiItem {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName: string;
  instructors: PublicCourseInstructor[];
  instructorName: string;
  duration: number | string | null;
  durationUnit: number | string | null;
  price: number | string;
  oldPrice: number | string | null;
  description: string | null;
  courseHighlights: string[];
  thumbnailUrl: string | null;
  lessonsCount: number;
  studentsCount: number;
  popularityCount: number;
  status: number;
  statusLabel: string;
  createdOn: string | null;
  updatedOn: string | null;
}

export interface PublicCoursePaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface PublicCourseSummary {
  totalCourses: number;
  totalCategories: number;
  totalStudents: number;
}

export interface PublicCoursesResponse {
  status: boolean;
  message: string;
  data: PublicCourseApiItem[];
  meta: PublicCoursePaginationMeta;
  summary: PublicCourseSummary;
}

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

  getPublicCourses(payload: any): Observable<PublicCoursesResponse> {
    return this.http.post<PublicCoursesResponse>(
      `${this.PRE_LOGIN_API_URL}/getPublicCourses`,
      payload,
      {},
    );
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
  createOfflineCourse(payload: any): any {
    return this.http.post(`${this.API_URL}/createOfflineCourse`, payload, {});
  }
  getOfflineCourses(payload: any = {}): any {
    return this.http.post(`${this.API_URL}/getOfflineCourses`, payload, {});
  }
  updateOfflineCourseStatus(payload: any): any {
    return this.http.post(`${this.API_URL}/updateOfflineCourseStatus`, payload, {});
  }
  deleteOfflineCourse(payload: any): any {
    return this.http.post(`${this.API_URL}/deleteOfflineCourse`, payload, {});
  }
  getCourses(payload: any): any {
    return this.http.post(`${this.API_URL}/getCourses`, payload, {});
  }
  getAllCourses(payload: any): any {
    return this.http.post(`${this.API_URL}/getAllCourses`, payload, {});
  }
  getCourseById(payload: any): any {
    return this.http.post(`${this.API_URL}/getCourseById`, payload, {});
  }
  updateCourse(payload: any): any {
    return this.http.post(`${this.API_URL}/updateCourse`, payload, {});
  }
}
