import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PaymentLog {
  id: number;
  orderReference?: string | null;
  invoiceNo: string;
  invoiceId?: number | null;
  entityType?: string | null;
  entityCode?: string | null;
  entityTitle?: string | null;
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

export interface PaymentWorkflowInstallment {
  id: number;
  paymentLogId: number;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  courseId: number;
  courseTitle?: string | null;
  enrollmentId?: number | null;
  installmentNo: number;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  dueStatus: 'paid' | 'overdue' | 'due_today' | 'upcoming' | string;
  expectedDate?: string | null;
  paidDate?: string | null;
  paymentBy?: string | null;
  transactionNo?: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceOrderId?: number | null;
  invoiceDownloadUrl?: string | null;
  createdAt?: string | null;
}

export interface PaymentWorkflowOrder {
  id: number;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  orderReference?: string | null;
  totalAmount: number;
  currency?: string | null;
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  failureReason?: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceDownloadUrl?: string | null;
  createdAt?: string | null;
}

export interface PaymentWorkflow {
  summary: {
    orders: number;
    paidOrders: number;
    failedOrders: number;
    pendingOrders: number;
    totalPaid: number;
    pendingInstallments: number;
    overdueInstallments: number;
    balanceAmount: number;
  };
  orders: PaymentWorkflowOrder[];
  installments: PaymentWorkflowInstallment[];
}

export type NormalizedPaymentStatus = 'pending' | 'success' | 'failed';

export interface PaymentStatusItem {
  moduleType: string;
  moduleId?: number | null;
  moduleCode?: string | null;
  moduleTitle: string;
  categoryName?: string | null;
  amount: number;
}

export interface PaymentStatusDetails {
  orderId: number;
  orderReference?: string | null;
  razorpayOrderId?: string | null;
  totalAmount: number;
  currency?: string | null;
  orderStatus: string;
  paymentStatus: NormalizedPaymentStatus;
  paymentTableStatus?: string | null;
  razorpayPaymentId?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  paymentDisplayId?: string | null;
  failureReason?: string | null;
  hasSignature: boolean;
  items: PaymentStatusItem[];
  invoice?: Invoice | null;
  enrollmentAccess: {
    hasAccess: boolean;
    status: string;
    activeCourseIds: number[];
  };
  nextAction: 'go_to_learning' | 'retry_payment' | 'check_status' | string;
}

export interface InvoiceItem {
  courseId: number;
  code?: string | null;
  entityType?: string | null;
  entityCode?: string | null;
  entityTitle?: string | null;
  title: string;
  categoryName: string;
  price: number | string;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
}

export interface Invoice {
  invoiceNo: string;
  orderId: number;
  entityType?: string | null;
  entityId?: number | null;
  entityCode?: string | null;
  entityTitle?: string | null;
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
  taxPercent?: number | string | null;
  tax?: number | string | null;
  totalAmount: number | string;
}

export interface MyLearningCourse {
  enrollmentId: number;
  id: number;
  code?: string | null;
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
  courseType?: number | string | null;
  stateCode?: number | null;
  stateName?: string | null;
  districtCode?: number | null;
  districtName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  branchAddress?: string | null;
  locationLabel?: string | null;
  venue?: string | null;
  city?: string | null;
  youtubeLiveUrl?: string | null;
  meetingLink?: string | null;
  enrolledAt: string;
  orderId?: number | null;
  invoiceNo?: string | null;
  razorpayOrderId?: string | null;
  progressPercent?: number;
  lastWatchedAt?: string | null;
  certificateNo?: string | null;
  certificateDownloadUrl?: string | null;
  certificateStatus?: string | null;
  certificateIssueDate?: string | null;
}

export type MyProgramType = 'workshop' | 'seminar';

export interface MyProgram {
  purchaseId: number;
  id: number;
  type: MyProgramType;
  entityType: string;
  code?: string | null;
  title: string;
  topic?: string | null;
  venue?: string | null;
  city?: string | null;
  stateCode?: number | null;
  stateName?: string | null;
  districtCode?: number | null;
  districtName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  branchAddress?: string | null;
  locationLabel?: string | null;
  eventDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  speakerName?: string | null;
  capacity?: number | string | null;
  price?: number | string | null;
  totalAmount?: number | string | null;
  description?: string | null;
  takeaways?: string[];
  bannerImage?: string | null;
  bannerImageUrl?: string | null;
  status: number;
  statusLabel?: string | null;
  scheduleStatus: 'upcoming' | 'ongoing' | 'completed';
  enrolledAt: string;
  orderId?: number | null;
  orderReference?: string | null;
  invoiceNo?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentReference?: string | null;
  paymentDisplayId?: string | null;
  certificateNo?: string | null;
  certificateDownloadUrl?: string | null;
  certificateStatus?: string | null;
  certificateIssueDate?: string | null;
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
    entityType?: string | null;
    entityCode?: string | null;
    entityTitle?: string | null;
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

  programCheckoutInit(payload: {
    entityType: 'workshop' | 'seminar';
    entityId: number;
  }): Observable<any> {
    return this.http.post(
      `${this.API_URL}/programCheckoutInit`,
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

  getPaymentStatus(params: {
    orderId?: number;
    orderReference?: string;
    razorpayOrderId?: string;
  }): Observable<{ success: boolean; message: string; paymentStatus: NormalizedPaymentStatus; data: PaymentStatusDetails }> {
    return this.http.get<{ success: boolean; message: string; paymentStatus: NormalizedPaymentStatus; data: PaymentStatusDetails }>(
      `${this.API_URL}/paymentStatus`,
      {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
        ) as Record<string, string>,
      },
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

  getMyPrograms(type?: MyProgramType): Observable<{ success: boolean; message: string; data: MyProgram[] }> {
    return this.http.get<{ success: boolean; message: string; data: MyProgram[] }>(
      `${this.API_URL}/myPrograms`,
      {
        params: type ? { type } : {},
      },
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

  downloadInvoice(orderId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.API_URL}/invoice/${orderId}/download`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  checkCourseAccess(courseId: number): Observable<{ success: boolean; message: string; hasAccess: boolean }> {
    return this.http.get<{ success: boolean; message: string; hasAccess: boolean }>(
      `${this.API_URL}/course-access/${courseId}`,
    );
  }

  getPaymentWorkflow(limit = 20): Observable<{ success: boolean; message: string; data: PaymentWorkflow }> {
    return this.http.get<{ success: boolean; message: string; data: PaymentWorkflow }>(
      `${this.API_URL}/workflow/payments`,
      {
        params: { limit },
      },
    );
  }

  getAdminPayments(params: Record<string, string | number> = {}): Observable<{ success: boolean; message: string; data: AdminPaymentDashboard }> {
    return this.http.get<{ success: boolean; message: string; data: AdminPaymentDashboard }>(
      `${this.API_URL}/admin/payments`,
      {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
        ) as Record<string, string>,
      },
    );
  }

  exportAdminPayments(params: Record<string, string | number> = {}): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.API_URL}/admin/payments/export`,
      {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
        ) as Record<string, string>,
        observe: 'response',
        responseType: 'blob',
      },
    );
  }
}
