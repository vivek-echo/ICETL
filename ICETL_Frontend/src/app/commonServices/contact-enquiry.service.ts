import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContactEnquiryPayload {
  fullName: string;
  email: string;
  phone: string;
  enquiryType: string;
  subject: string;
  message: string;
}

export interface ContactEnquiry {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  enquiryType: string;
  subject: string;
  message: string;
  isRead: boolean;
  statusLabel: string;
  readByName?: string | null;
  readOn?: string | null;
  ipAddress?: string | null;
  createdOn: string;
  updatedOn?: string | null;
}

export interface EnquiryListResponse {
  status: boolean;
  message: string;
  data: ContactEnquiry[];
  meta?: {
    currentPage: number;
    perPage: number | 'all';
    total: number;
    lastPage: number;
    from?: number | null;
    to?: number | null;
  };
  summary?: {
    totalEnquiries: number;
    unreadEnquiries: number;
    readEnquiries: number;
  };
}

export interface UnreadEnquiryResponse {
  status: boolean;
  message: string;
  data: {
    unreadCount: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ContactEnquiryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  submitEnquiry(payload: ContactEnquiryPayload): Observable<{ status: boolean; message: string }> {
    return this.http.post<{ status: boolean; message: string }>(
      `${this.apiUrl}/contact-enquiries`,
      payload,
    );
  }

  getEnquiries(payload: Record<string, string | number>): Observable<EnquiryListResponse> {
    return this.http.post<EnquiryListResponse>(`${this.apiUrl}/getContactEnquiries`, payload);
  }

  getUnreadCount(): Observable<UnreadEnquiryResponse> {
    return this.http.get<UnreadEnquiryResponse>(`${this.apiUrl}/contact-enquiries/unread-count`);
  }

  markRead(ids: number[]): Observable<{ status: boolean; message: string }> {
    return this.http.post<{ status: boolean; message: string }>(
      `${this.apiUrl}/contact-enquiries/mark-read`,
      { ids },
    );
  }

  markAllRead(): Observable<{ status: boolean; message: string }> {
    return this.http.post<{ status: boolean; message: string }>(
      `${this.apiUrl}/contact-enquiries/mark-read`,
      { markAll: true },
    );
  }
}
