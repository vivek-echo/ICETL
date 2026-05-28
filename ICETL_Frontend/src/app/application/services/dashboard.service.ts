import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardMetric {
  label: string;
  value: number | string;
  helper?: string;
  icon?: string;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export interface DashboardCourse {
  id: number;
  title: string;
  categoryName?: string | null;
  status?: string | number | null;
  students?: number;
  revenue?: number;
  progressPercent?: number;
  instructorName?: string | null;
  createdAt?: string | null;
}

export interface DashboardTransaction {
  id: number;
  orderReference?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  totalAmount?: number | string | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface LearnerDashboardData {
  summary: {
    enrolledCourses: number;
    activeCourses: number;
    completedCourses: number;
    averageProgress: number;
    cartItems: number;
    totalSpent: number;
  };
  progressBreakdown: DashboardChartPoint[];
  recentCourses: DashboardCourse[];
  recentPayments: DashboardTransaction[];
}

export interface InstructorDashboardData {
  summary: {
    totalCourses: number;
    activeCourses: number;
    enrolledLearners: number;
    totalRevenue: number;
    averageProgress: number;
    pendingCourses: number;
  };
  courseStatus: DashboardChartPoint[];
  topCourses: DashboardCourse[];
  recentLearners: Array<DashboardCourse & { learnerName?: string | null; learnerEmail?: string | null }>;
}

export interface AdminDashboardData {
  summary: {
    learners: number;
    instructors: number;
    courses: number;
    activeCourses: number;
    enrollments: number;
    revenue: number;
    successfulPayments: number;
    failedPayments: number;
  };
  monthlyRevenue: DashboardChartPoint[];
  userRoles: DashboardChartPoint[];
  courseCategories: DashboardChartPoint[];
  recentTransactions: DashboardTransaction[];
  recentCourses: DashboardCourse[];
}

interface DashboardResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getLearnerDashboard(): Observable<DashboardResponse<LearnerDashboardData>> {
    return this.http.get<DashboardResponse<LearnerDashboardData>>(`${this.apiUrl}/dashboard/learner`);
  }

  getInstructorDashboard(): Observable<DashboardResponse<InstructorDashboardData>> {
    return this.http.get<DashboardResponse<InstructorDashboardData>>(
      `${this.apiUrl}/dashboard/instructor`,
    );
  }

  getAdminDashboard(): Observable<DashboardResponse<AdminDashboardData>> {
    return this.http.get<DashboardResponse<AdminDashboardData>>(`${this.apiUrl}/dashboard/admin`);
  }
}
