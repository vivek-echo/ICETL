import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export type SeminarScheduleStatus = 'upcoming' | 'ongoing' | 'completed';
export type SeminarScheduleFilter = '' | 'all' | SeminarScheduleStatus;
export type SeminarSortOption = 'newest' | 'oldest' | 'dateAsc' | 'dateDesc';

export interface SeminarPayload {
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

export interface SeminarItem extends SeminarPayload {
  id: number;
  code?: string | null;
  type: 'seminar';
  bannerImage?: string | null;
  bannerImageUrl?: string | null;
  statusLabel: string;
  scheduleStatus: SeminarScheduleStatus;
  createdById: number | null;
  createdByName: string;
  createdByEmail: string | null;
  createdOn: string | null;
  updatedOn: string | null;
}

export interface SeminarPaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface SeminarSummary {
  totalSeminars: number;
  activeSeminars: number;
  inactiveSeminars: number;
  upcomingSeminars: number;
  ongoingSeminars?: number;
  completedSeminars: number;
}

export interface SeminarListResponse {
  status: boolean;
  message: string;
  data: SeminarItem[];
  summary?: SeminarSummary;
  meta?: SeminarPaginationMeta;
}

export interface SeminarDetailResponse {
  status: boolean;
  message: string;
  data: SeminarItem;
}

export interface SeminarMutationResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    code?: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SeminarService {
  private readonly API_URL = environment.apiUrl;
  private readonly PRE_LOGIN_API_URL = environment.preLoginApi;

  constructor(private readonly http: HttpClient) {}

  createSeminar(payload: SeminarPayload | FormData): Observable<SeminarMutationResponse> {
    return this.http.post<SeminarMutationResponse>(`${this.API_URL}/createSeminar`, payload);
  }

  getMySeminars(payload: Record<string, unknown> = {}): Observable<SeminarListResponse> {
    return this.http.post<SeminarListResponse>(
      `${this.API_URL}/getMySeminars`,
      payload,
      this.listRequestOptions(),
    );
  }

  getAllSeminars(payload: Record<string, unknown> = {}): Observable<SeminarListResponse> {
    return this.http.post<SeminarListResponse>(
      `${this.API_URL}/getAllSeminars`,
      payload,
      this.listRequestOptions(),
    );
  }

  getPublicSeminars(payload: Record<string, unknown> = {}): Observable<SeminarListResponse> {
    return this.http.post<SeminarListResponse>(
      `${this.PRE_LOGIN_API_URL}/getPublicSeminars`,
      payload,
      this.listRequestOptions(),
    );
  }

  getSeminarById(payload: { id: number }): Observable<SeminarDetailResponse> {
    return this.http.post<SeminarDetailResponse>(`${this.API_URL}/getSeminarById`, payload);
  }

  updateSeminar(payload: (SeminarPayload & { id: number }) | FormData): Observable<SeminarMutationResponse> {
    return this.http.post<SeminarMutationResponse>(`${this.API_URL}/updateSeminar`, payload);
  }

  updateSeminarStatus(payload: {
    id: number;
    status: number;
  }): Observable<SeminarMutationResponse> {
    return this.http.post<SeminarMutationResponse>(`${this.API_URL}/updateSeminarStatus`, payload);
  }

  deleteSeminar(payload: { id: number }): Observable<SeminarMutationResponse> {
    return this.http.post<SeminarMutationResponse>(`${this.API_URL}/deleteSeminar`, payload);
  }

  private listRequestOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }
}
