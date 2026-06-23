import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export interface OfflineCourseInstructor {
  id: number;
  name: string;
  email?: string | null;
}

export interface OfflineCoursePayload {
  title: string;
  categoryId: number | null;
  categoryName: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string | null;
  youtubeLiveUrl: string | null;
  meetingLink: string | null;
  instructors: OfflineCourseInstructor[];
  instructorName: string;
  price: number;
  description: string;
  highlights: string[];
  status: number;
}

export type OfflineCourseScheduleStatus = 'upcoming' | 'ongoing' | 'completed';
export type OfflineCourseScheduleFilter = '' | 'all' | OfflineCourseScheduleStatus;
export type OfflineCourseSortOption = 'newest' | 'oldest' | 'dateAsc' | 'dateDesc';

export interface OfflineCourseItem extends OfflineCoursePayload {
  id: number;
  code?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  statusLabel?: string;
  scheduleStatus?: OfflineCourseScheduleStatus;
  isEnrolled?: boolean;
  courseType?: number;
  courseHighlights?: string[];
  createdById: number | null;
  createdByName: string;
  createdByEmail?: string | null;
  createdOn: string;
  updatedOn: string;
}

export interface OfflineCoursePaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface OfflineCourseSummary {
  totalCourses: number;
  activeCourses: number;
  inactiveCourses: number;
  upcomingCourses: number;
  ongoingCourses: number;
  completedCourses: number;
}

export interface OfflineCourseListResponse {
  status: boolean;
  message: string;
  data: OfflineCourseItem[];
  summary?: OfflineCourseSummary;
  meta?: OfflineCoursePaginationMeta;
}

export type OfflineCourseEnrollmentInstallmentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'OVERDUE';
export type OfflineCourseEnrollmentPaymentBy = 'CASH' | 'UPI' | 'NETBANKING';
export type OfflineInstallmentPaymentType =
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CARD'
  | 'OTHER';

export interface OfflineCourseEnrollmentInstallmentPayload {
  installmentNo: number;
  amount: number;
  expectedDate: string | null;
  status: OfflineCourseEnrollmentInstallmentStatus;
}

export interface OfflineCourseEnrollmentPayload {
  courseId: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: 1 | 2;
  paymentBy: OfflineCourseEnrollmentPaymentBy;
  transactionNo: string | null;
  totalFee: number;
  amountPaid: number;
  amountBalance: number;
  paidInFull: boolean;
  installments: OfflineCourseEnrollmentInstallmentPayload[];
}

export interface OfflineCourseEnrollmentResponse {
  status: boolean;
  message: string;
  data?: {
    userId: number;
    courseId: number;
    courseCode?: string | null;
    invoiceNumber: string;
    paymentStatus: 'PAID' | 'PARTIAL';
  };
  errors?: Record<string, string[]>;
}

export interface OfflineCourseStudentInstallment {
  id: number | null;
  paymentLogId: number;
  enrollmentId?: number | null;
  installmentNo: number;
  amount: number;
  installmentAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
  expectedDate: string | null;
  paidDate: string | null;
  paymentDate?: string | null;
  paymentBy: OfflineCourseEnrollmentPaymentBy | null;
  paymentType?: OfflineInstallmentPaymentType | OfflineCourseEnrollmentPaymentBy | string | null;
  transactionNo: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceOrderId?: number | null;
  invoiceDownloadUrl?: string | null;
  remarks?: string | null;
  status: OfflineCourseEnrollmentInstallmentStatus;
  paymentStatus?: OfflineCourseEnrollmentInstallmentStatus;
  isOverdue?: boolean;
}

export interface OfflineCourseStudentItem {
  id: number;
  enrollmentId: number;
  enrollmentStatus: string;
  enrolledAt: string | null;
  studentId: number;
  studentCode?: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  studentDob: string | null;
  studentGender: number | null;
  courseId: number;
  courseCode?: string | null;
  courseTitle: string;
  categoryName: string;
  coursePrice: number;
  venue: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  orderId: number | null;
  orderReference: string | null;
  paymentId: number | null;
  paymentLogId: number | null;
  totalFee: number;
  amountPaid: number;
  amountBalance: number;
  paymentStatus: 'PAID' | 'PARTIAL';
  paymentMode: string | null;
  paymentBy: string | null;
  referenceNo: string | null;
  transactionNo: string | null;
  paymentDisplayId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  installmentCount: number;
  pendingInstallments: number;
  paidInstallments: number;
  pendingInstallmentAmount: number;
  paidInstallmentAmount: number;
  overdueInstallments: number;
  nextInstallmentDate: string | null;
  nextUpcomingInstallmentDate: string | null;
  installments: OfflineCourseStudentInstallment[];
}

export interface OfflineCourseStudentSummary {
  totalEnrollments: number;
  totalStudents: number;
  totalCourses: number;
  paidStudents: number;
  partialStudents: number;
  pendingInstallments: number;
  overdueInstallments: number;
  totalFee: number;
  totalPaid: number;
  totalBalance: number;
  nextInstallmentDate: string | null;
  nextUpcomingInstallmentDate: string | null;
}

export interface OfflineCourseStudentsResponse {
  status: boolean;
  message: string;
  data: OfflineCourseStudentItem[];
  meta: OfflineCoursePaginationMeta;
  summary: OfflineCourseStudentSummary;
}

export interface OfflineCourseInstallmentUpdatePayload {
  paymentLogId: number;
  installments: Array<{
    id: number | null;
    installmentNo: number;
    amount: number;
    expectedDate: string | null;
    paidDate: string | null;
    paymentBy: OfflineInstallmentPaymentType | OfflineCourseEnrollmentPaymentBy | null;
    transactionNo: string | null;
    status: OfflineCourseEnrollmentInstallmentStatus;
  }>;
}

export interface OfflineCourseInstallmentUpdateResponse {
  status: boolean;
  message: string;
  data?: {
    paymentLogId: number;
    paymentStatus: 'PAID' | 'PARTIAL';
    totalFee: number;
    amountPaid: number;
    amountBalance: number;
    installments: OfflineCourseStudentInstallment[];
  };
  errors?: Record<string, string[]>;
}

export interface OfflineCourseInstallmentPayPayload {
  enrollmentId: number;
  installmentId: number;
  paymentDate: string;
  paymentType: OfflineInstallmentPaymentType;
  transactionNo: string | null;
  amountPaid: number;
  remarks: string | null;
}

export interface OfflineCourseInstallmentInvoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  invoiceDate: string | null;
  invoiceAmount: number;
  downloadUrl: string | null;
}

export interface OfflineCourseInstallmentPayResponse {
  status: boolean;
  message: string;
  data?: {
    enrollmentId: number;
    installmentId: number;
    courseCode?: string | null;
    paymentStatus: OfflineCourseEnrollmentInstallmentStatus;
    amountPaid: number;
    balanceAmount: number;
    summary?: {
      paymentStatus: 'PAID' | 'PARTIAL';
      totalFee: number;
      amountPaid: number;
      amountBalance: number;
    };
    installment?: OfflineCourseStudentInstallment | null;
    invoice?: OfflineCourseInstallmentInvoice | null;
  };
  errors?: Record<string, string[]>;
}

interface StoredAuthUser {
  id?: number | string | null;
  name?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineCourseStore {
  private readonly storageKey = 'icetl_offline_courses';
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  addCourse(payload: OfflineCoursePayload): OfflineCourseItem {
    const courses = this.getCourses();
    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();
    const course: OfflineCourseItem = {
      ...payload,
      id: Date.now(),
      code: null,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdOn: now,
      updatedOn: now,
    };

    this.saveCourses([course, ...courses]);

    return course;
  }

  getCourses(): OfflineCourseItem[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const rawCourses = localStorage.getItem(this.storageKey);
      const courses = rawCourses ? JSON.parse(rawCourses) : [];

      return Array.isArray(courses) ? courses.map((course) => this.normalizeCourse(course)) : [];
    } catch {
      return [];
    }
  }

  getMyCourses(): OfflineCourseItem[] {
    const currentUser = this.getCurrentUser();
    const courses = this.getCourses();

    if (!currentUser.id) {
      return courses;
    }

    return courses.filter((course) => course.createdById === currentUser.id);
  }

  deleteCourse(courseId: number): void {
    this.saveCourses(this.getCourses().filter((course) => course.id !== courseId));
  }

  updateCourseStatus(courseId: number, status: number): void {
    const courses = this.getCourses().map((course) =>
      course.id === courseId
        ? {
            ...course,
            status,
            updatedOn: new Date().toISOString(),
          }
        : course,
    );

    this.saveCourses(courses);
  }

  private saveCourses(courses: OfflineCourseItem[]): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(courses));
  }

  private getCurrentUser(): { id: number | null; name: string } {
    if (!this.isBrowser) {
      return { id: null, name: 'Current User' };
    }

    try {
      const rawUser = localStorage.getItem('auth_user');
      const user = rawUser ? (JSON.parse(rawUser) as StoredAuthUser) : null;
      const parsedId = Number(user?.id);

      return {
        id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null,
        name: user?.name?.trim() || 'Current User',
      };
    } catch {
      return { id: null, name: 'Current User' };
    }
  }

  private normalizeCourse(value: Partial<OfflineCourseItem>): OfflineCourseItem {
    return {
      id: Number(value.id) || Date.now(),
      code: value.code ? `${value.code}`.trim() : null,
      title: `${value.title || ''}`.trim(),
      categoryId: this.normalizeNullableNumber(value.categoryId),
      categoryName: `${value.categoryName || 'Uncategorized'}`.trim(),
      venue: `${value.venue || ''}`.trim(),
      city: `${value.city || ''}`.trim(),
      startDate: `${value.startDate || ''}`.trim(),
      endDate: value.endDate ? `${value.endDate}`.trim() : null,
      startTime: `${value.startTime || ''}`.trim(),
      endTime: value.endTime ? `${value.endTime}`.trim() : null,
      youtubeLiveUrl: value.youtubeLiveUrl ? `${value.youtubeLiveUrl}`.trim() : null,
      meetingLink: value.meetingLink ? `${value.meetingLink}`.trim() : null,
      instructors: this.normalizeInstructors(value.instructors),
      instructorName: this.getInstructorNames(value),
      price: Number(value.price) || 0,
      description: `${value.description || ''}`.trim(),
      thumbnail: value.thumbnail ? `${value.thumbnail}`.trim() : null,
      thumbnailUrl: value.thumbnailUrl ? `${value.thumbnailUrl}`.trim() : null,
      highlights: Array.isArray(value.highlights)
        ? value.highlights.map((item) => `${item}`.trim()).filter((item) => item.length > 0)
        : [],
      status: Number(value.status) === 0 ? 0 : 1,
      createdById:
        value.createdById === null || value.createdById === undefined
          ? null
          : Number(value.createdById) || null,
      createdByName: `${value.createdByName || 'Current User'}`.trim(),
      createdOn: `${value.createdOn || new Date().toISOString()}`,
      updatedOn: `${value.updatedOn || value.createdOn || new Date().toISOString()}`,
    };
  }

  private normalizeInstructors(value: OfflineCourseInstructor[] | unknown): OfflineCourseInstructor[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item): OfflineCourseInstructor | null => {
        const instructor = item as Partial<OfflineCourseInstructor>;
        const id = Number(instructor.id);
        const name = `${instructor.name || ''}`.trim();

        if (!Number.isFinite(id) || id <= 0 || !name) {
          return null;
        }

        return {
          id,
          name,
          email: instructor.email ? `${instructor.email}`.trim() : null,
        };
      })
      .filter((item): item is OfflineCourseInstructor => item !== null);
  }

  private getInstructorNames(value: Partial<OfflineCourseItem>): string {
    const instructorNames = this.normalizeInstructors(value.instructors)
      .map((instructor) => instructor.name)
      .join(', ');

    return instructorNames || `${value.instructorName || 'Instructor'}`.trim();
  }

  private normalizeNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
