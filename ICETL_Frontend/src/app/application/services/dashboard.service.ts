import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardMetric {
  label: string;
  value: number | string;
  helper?: string;
  icon?: string;
  route?: string | null;
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

export interface WorkflowActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  moduleType?: string | null;
  moduleId?: number | null;
  createdAt?: string | null;
  routeKey?: string | null;
  status?: string | null;
}

export interface WorkflowMaterial {
  id: number;
  moduleType: string;
  moduleId: number;
  title: string;
  originalFileName: string;
  fileExtension?: string | null;
  fileSizeLabel?: string | null;
  materialDate?: string | null;
  createdAt?: string | null;
  downloadUrl?: string | null;
  viewUrl?: string | null;
  uploadedBy?: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
  };
}

export interface WorkflowCertificate {
  id: number;
  certificateNo?: string | null;
  moduleType?: string | null;
  moduleId: number;
  moduleTitle?: string | null;
  issueDate?: string | null;
  verificationUrl?: string | null;
  downloadAvailable: boolean;
  downloadUrl?: string | null;
  verificationStatus?: string | null;
  status?: string | null;
}

export interface PaymentWorkflowSummary {
  orders: number;
  paidOrders: number;
  failedOrders: number;
  pendingOrders: number;
  totalPaid: number;
  pendingInstallments: number;
  overdueInstallments: number;
  balanceAmount: number;
}

export interface LearnerWorkflowData {
  summary: {
    continueLearning: number;
    certificateReadyCourses: number;
    generatedCertificates: number;
    pendingPayments: number;
    pendingInstallments: number;
    overdueInstallments: number;
    recentMaterials: number;
  };
  continueLearning: Array<{
    enrollmentId: number;
    courseId: number;
    title: string;
    progressPercent: number;
    lastWatchedAt?: string | null;
  }>;
  certificates: WorkflowCertificate[];
  recentMaterials: WorkflowMaterial[];
  activity: WorkflowActivity[];
  paymentSummary: PaymentWorkflowSummary;
}

export interface InstructorWorkflowData {
  summary: {
    assignedCourses: number;
    assignedWorkshops: number;
    assignedSeminars: number;
    recentMaterialUploads: number;
    offlinePending: number;
    offlineApproved: number;
    offlineRejected: number;
    recentEnrolledStudents: number;
  };
  offlineCourseStatus: DashboardChartPoint[];
  recentMaterials: WorkflowMaterial[];
  activity: WorkflowActivity[];
}

export interface AdminWorkflowData {
  summary: {
    pendingApprovals: number;
    recentEnrollments: number;
    recentPayments: number;
    failedOrPendingPayments: number;
    pendingInstallments: number;
    overdueInstallments: number;
    recentCertificates: number;
    recentMaterialUploads: number;
  };
  pendingApprovals: Array<{
    id: number;
    title: string;
    creatorName?: string | null;
    createdAt?: string | null;
    status?: string | null;
  }>;
  recentEnrollments: Array<{
    id: number;
    userId: number;
    courseId: number;
    courseTitle?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    status?: string | null;
    createdAt?: string | null;
  }>;
  recentPayments: DashboardTransaction[];
  recentCertificates: WorkflowCertificate[];
  recentMaterials: WorkflowMaterial[];
  activity: WorkflowActivity[];
  paymentSummary: PaymentWorkflowSummary;
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
  workflow?: LearnerWorkflowData;
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
  workflow?: InstructorWorkflowData;
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
  workflow?: AdminWorkflowData;
}

export interface DynamicDashboardAction {
  id?: number | string;
  label: string;
  route: string;
  icon?: string | null;
  helper?: string | null;
}

export interface DynamicDashboardData {
  role: {
    id: number | null;
    name: string;
    dashboardUrl?: string | null;
  };
  kind: 'admin' | 'instructor' | 'learner' | 'generic';
  summary: DashboardMetric[];
  menuModules: DynamicDashboardAction[];
  activity: WorkflowActivity[];
  payload?: AdminDashboardData | InstructorDashboardData | LearnerDashboardData | Record<string, unknown>;
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

  getCurrentDashboard(): Observable<DashboardResponse<DynamicDashboardData>> {
    return this.http.get<DashboardResponse<DynamicDashboardData>>(`${this.apiUrl}/dashboard`);
  }
}
