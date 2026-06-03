import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PaymentLog {
  id: number;
  orderReference?: string | null;
  invoiceNo: string;
  invoiceId?: number | null;
  totalAmount: number | string;
  currency?: string;
  status: string;
  paymentStatus?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  paymentBy?: string | null;
  transactionNo?: string | null;
  paymentDisplayId?: string | null;
  failureReason?: string | null;
  created_at: string;
  courseCount: number;
  refundStatus?: string | null;
}

export interface InvoiceItem {
  courseId: number;
  title: string;
  categoryName: string;
  price: number | string;
}

export interface Invoice {
  invoiceNo: string;
  orderId: number;
  orderReference?: string | null;
  orderDate: string;
  invoiceDate?: string;
  status: string;
  paymentStatus?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  paymentBy?: string | null;
  transactionNo?: string | null;
  paymentDisplayId?: string | null;
  currency: string;
  company?: {
    name: string;
    subtitle?: string;
    email?: string;
  };
  customer: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  items: InvoiceItem[];
  subtotal: number | string;
  totalAmount: number | string;
}

export interface MyLearningCourse {
  enrollmentId: number;
  id: number;
  title: string;
  categoryId?: number;
  categoryName?: string | null;
  instructors?: Array<{ id: number; name: string }>;
  instructorName?: string | null;
  duration?: number | string | null;
  durationUnit?: number | string | null;
  price?: number | string | null;
  oldPrice?: number | string | null;
  description?: string | null;
  courseHighlights?: string[];
  thumbnailUrl?: string | null;
  status: number;
  statusLabel?: string;
  enrolledAt: string;
  orderId?: number | null;
  invoiceNo?: string | null;
  razorpayOrderId?: string | null;
  progressPercent?: number;
  lastWatchedAt?: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta?: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface AdminPaymentDashboard {
  summary: {
    revenue: number;
    successfulPayments: number;
    failedPayments: number;
    refundRequests: number;
  };
  recentTransactions: Array<{
    id: number;
    orderReference: string;
    totalAmount: number | string;
    status: string;
    created_at: string;
    userName?: string | null;
    userEmail?: string | null;
    razorpayPaymentId?: string | null;
    paymentReference?: string | null;
    paymentMethod?: string | null;
    paymentBy?: string | null;
    transactionNo?: string | null;
    paymentDisplayId?: string | null;
    invoiceNumber?: string | null;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  public API_URL = environment.apiUrl;
  constructor(private http: HttpClient) {}
  checkoutInit(payload: any): Observable<any> {
    return this.http.post(
      `${this.API_URL}/cartCheckoutInit`,
      payload
    );
  }
  
  verifyPayment(payload: any): Observable<any> {
    return this.http.post(
      `${this.API_URL}/verifyPayment`,
      payload
    );
  }

  markPaymentFailure(payload: any): Observable<any> {
    return this.http.post(
      `${this.API_URL}/paymentFailure`,
      payload,
    );
  }

  getPaymentLogs(params: Record<string, string | number> = {}): Observable<PaginatedResponse<PaymentLog>> {
    return this.http.get<PaginatedResponse<PaymentLog>>(`${this.API_URL}/paymentLogs`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
      ) as Record<string, string>,
    });
  }

  getMyLearning(): Observable<{ success: boolean; message: string; data: MyLearningCourse[] }> {
    return this.http.get<{ success: boolean; message: string; data: MyLearningCourse[] }>(
      `${this.API_URL}/myLearning`,
    );
  }

  getInvoice(orderId: number): Observable<{ success: boolean; message: string; data: Invoice }> {
    return this.http.get<{ success: boolean; message: string; data: Invoice }>(
      `${this.API_URL}/invoice/${orderId}`,
    );
  }

  getInvoiceDownloadUrl(orderId: number): string {
    return `${this.API_URL}/invoice/${orderId}/download`;
  }

  checkCourseAccess(courseId: number): Observable<{ success: boolean; message: string; hasAccess: boolean }> {
    return this.http.get<{ success: boolean; message: string; hasAccess: boolean }>(
      `${this.API_URL}/course-access/${courseId}`,
    );
  }

  getAdminPayments(): Observable<{ success: boolean; message: string; data: AdminPaymentDashboard }> {
    return this.http.get<{ success: boolean; message: string; data: AdminPaymentDashboard }>(
      `${this.API_URL}/admin/payments`,
    );
  }
}
