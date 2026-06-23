import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export type WorkshopScheduleStatus = 'upcoming' | 'ongoing' | 'completed';
export type WorkshopScheduleFilter = '' | 'all' | WorkshopScheduleStatus;
export type WorkshopSortOption = 'newest' | 'oldest' | 'dateAsc' | 'dateDesc';
const PRE_LOGIN_ALLOWED_PAGE_SIZES = new Set<unknown>([10, 20, 50, 100, 'all']);
const PRE_LOGIN_DEFAULT_PAGE_SIZE = 10;

export interface WorkshopPayload {
  title: string;
  topic: string;
  venue: string;
  city: string;
  eventDate: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string | null;
  speakerName: string;
  capacity: number;
  price: number;
  description: string;
  takeaways: string[];
  status: number;
}

export interface WorkshopItem extends WorkshopPayload {
  id: number;
  code?: string | null;
  type: 'workshop';
  bannerImage?: string | null;
  bannerImageUrl?: string | null;
  statusLabel: string;
  scheduleStatus: WorkshopScheduleStatus;
  createdById: number | null;
  createdByName: string;
  createdByEmail: string | null;
  createdOn: string | null;
  updatedOn: string | null;
}

export interface WorkshopPaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface WorkshopSummary {
  totalWorkshops: number;
  activeWorkshops: number;
  inactiveWorkshops: number;
  upcomingWorkshops: number;
  ongoingWorkshops?: number;
  completedWorkshops: number;
}

export interface WorkshopListResponse {
  status: boolean;
  message: string;
  data: WorkshopItem[];
  summary?: WorkshopSummary;
  meta?: WorkshopPaginationMeta;
}

export interface WorkshopDetailResponse {
  status: boolean;
  message: string;
  data: WorkshopItem;
}

export interface WorkshopMutationResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    code?: string | null;
  };
}

export interface WorkshopEnrollmentPayload {
  workshopId: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: number;
  paymentBy: 'CASH' | 'UPI' | 'NETBANKING';
  transactionNo?: string | null;
  totalFee: number;
}

export interface WorkshopEnrolledStudent {
  id: number;
  orderId: number;
  studentId: number;
  studentCode?: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string | null;
  studentDob?: string | null;
  studentGender?: number | null;
  programType: 'workshop';
  programId: number;
  programCode?: string | null;
  programTitle: string;
  programTopic: string;
  programVenue: string;
  programCity: string;
  programStartDate?: string | null;
  programEndDate?: string | null;
  programStartTime?: string | null;
  programEndTime?: string | null;
  programSpeakerName: string;
  programCapacity: number;
  programStatus: number;
  programStatusLabel: string;
  scheduleStatus: WorkshopScheduleStatus;
  invoiceNo?: string | null;
  orderReference?: string | null;
  paymentReference?: string | null;
  paymentMode?: string | null;
  amountPaid: number | string;
  enrolledAt?: string | null;
}

export interface WorkshopEnrolledStudentSummary {
  totalEnrollments: number;
  totalStudents: number;
  totalPaid: number;
}

export interface WorkshopEnrolledStudentListResponse {
  status: boolean;
  message: string;
  data: WorkshopEnrolledStudent[];
  summary?: WorkshopEnrolledStudentSummary;
  meta?: WorkshopPaginationMeta;
}

@Injectable({
  providedIn: 'root',
})
export class WorkshopService {
  private readonly API_URL = environment.apiUrl;
  private readonly PRE_LOGIN_API_URL = environment.preLoginApi;

  constructor(private readonly http: HttpClient) {}

  createWorkshop(payload: WorkshopPayload | FormData): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/createWorkshop`, payload);
  }

  getMyWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.http.post<WorkshopListResponse>(
      `${this.API_URL}/getMyWorkshops`,
      payload,
      this.listRequestOptions(),
    );
  }

  getAllWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.http.post<WorkshopListResponse>(
      `${this.API_URL}/getAllWorkshops`,
      payload,
      this.listRequestOptions(),
    );
  }

  getPublicWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.http.post<WorkshopListResponse>(
      `${this.PRE_LOGIN_API_URL}/getPublicWorkshops`,
      payload,
      this.listRequestOptions(),
    );
  }

  getPreLoginWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.getPublicWorkshops(this.normalizePreLoginPayload(payload));
  }

  getWorkshopById(payload: { id: number }): Observable<WorkshopDetailResponse> {
    return this.http.post<WorkshopDetailResponse>(`${this.API_URL}/getWorkshopById`, payload);
  }

  updateWorkshop(payload: (WorkshopPayload & { id: number }) | FormData): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/updateWorkshop`, payload);
  }

  updateWorkshopStatus(payload: {
    id: number;
    status: number;
  }): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/updateWorkshopStatus`, payload);
  }

  deleteWorkshop(payload: { id: number }): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/deleteWorkshop`, payload);
  }

  enrollStudent(payload: WorkshopEnrollmentPayload): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/workshops/enroll-student`, payload);
  }

  getEnrolledStudents(payload: Record<string, unknown> = {}): Observable<WorkshopEnrolledStudentListResponse> {
    return this.http.post<WorkshopEnrolledStudentListResponse>(
      `${this.API_URL}/workshops/enrolled-students`,
      payload,
      this.listRequestOptions(),
    );
  }

  private listRequestOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }

  private normalizePreLoginPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const rawPerPage = payload['perPage'];
    const numericPerPage =
      typeof rawPerPage === 'string' && rawPerPage !== 'all' && rawPerPage.trim() !== ''
        ? Number(rawPerPage)
        : rawPerPage;

    return {
      page: 1,
      ...payload,
      perPage: PRE_LOGIN_ALLOWED_PAGE_SIZES.has(numericPerPage)
        ? numericPerPage
        : PRE_LOGIN_DEFAULT_PAGE_SIZE,
    };
  }
}
