import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type WorkshopScheduleStatus = 'upcoming' | 'completed';
export type WorkshopScheduleFilter = '' | 'all' | WorkshopScheduleStatus;
export type WorkshopSortOption = 'newest' | 'oldest' | 'dateAsc' | 'dateDesc';

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
  type: 'workshop';
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
  };
}

@Injectable({
  providedIn: 'root',
})
export class WorkshopService {
  private readonly API_URL = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  createWorkshop(payload: WorkshopPayload): Observable<WorkshopMutationResponse> {
    return this.http.post<WorkshopMutationResponse>(`${this.API_URL}/createWorkshop`, payload);
  }

  getMyWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.http.post<WorkshopListResponse>(`${this.API_URL}/getMyWorkshops`, payload);
  }

  getAllWorkshops(payload: Record<string, unknown> = {}): Observable<WorkshopListResponse> {
    return this.http.post<WorkshopListResponse>(`${this.API_URL}/getAllWorkshops`, payload);
  }

  getWorkshopById(payload: { id: number }): Observable<WorkshopDetailResponse> {
    return this.http.post<WorkshopDetailResponse>(`${this.API_URL}/getWorkshopById`, payload);
  }

  updateWorkshop(payload: WorkshopPayload & { id: number }): Observable<WorkshopMutationResponse> {
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
}
