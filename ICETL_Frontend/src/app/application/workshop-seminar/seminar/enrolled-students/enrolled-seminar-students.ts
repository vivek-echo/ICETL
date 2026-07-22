import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import {
  SeminarEnrolledStudent,
  SeminarEnrolledStudentSummary,
  SeminarPaginationMeta,
  SeminarScheduleFilter,
  SeminarService,
} from '../../services/seminar';

type StudentSortOption =
  | 'newest'
  | 'oldest'
  | 'studentAsc'
  | 'studentDesc'
  | 'programAsc'
  | 'programDesc'
  | 'amountAsc'
  | 'amountDesc';

@Component({
  selector: 'app-enrolled-seminar-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enrolled-seminar-students.html',
  styleUrl: './enrolled-seminar-students.scss',
})
export class EnrolledSeminarStudents implements OnInit {
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4];
  readonly scheduleFilters: Array<{ value: SeminarScheduleFilter; label: string }> = [
    { value: '', label: 'All Timeline' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
  ];
  readonly sortOptions: Array<{ value: StudentSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Enrolled' },
    { value: 'oldest', label: 'Oldest Enrolled' },
    { value: 'studentAsc', label: 'Student A-Z' },
    { value: 'programAsc', label: 'Seminar A-Z' },
    { value: 'amountDesc', label: 'Amount High-Low' },
    { value: 'amountAsc', label: 'Amount Low-High' },
  ];

  students: SeminarEnrolledStudent[] = [];
  loading = false;
  showFilters = false;
  search = '';
  programCode = '';
  status = '';
  scheduleStatus: SeminarScheduleFilter = '';
  paymentMode = '';
  sortBy: StudentSortOption = 'newest';
  pageInput = 1;
  meta: SeminarPaginationMeta = this.createDefaultMeta();
  summary: SeminarEnrolledStudentSummary = this.createDefaultSummary();

  private requestSerial = 0;

  constructor(
    private readonly seminarService: SeminarService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadStudents();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  async loadStudents(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.seminarService.getEnrolledStudents(this.buildPayload(page)).pipe(timeout(15000)),
      );

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.students = response.data || [];
        this.meta = response.meta || this.createDefaultMeta();
        this.summary = response.summary || this.createDefaultSummary();
        this.pageInput = this.meta.currentPage;

        if (this.students.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadStudents(this.meta.currentPage - 1);
        }
      } else {
        this.resetResults();
      }
    } catch (error) {
      console.error(error);
      if (requestId === this.requestSerial) {
        this.resetResults();
      }
    } finally {
      if (requestId === this.requestSerial) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  onSearch(): void {
    void this.loadStudents(1);
  }

  onFilterChange(): void {
    void this.loadStudents(1);
  }

  clearFilters(): void {
    this.search = '';
    this.programCode = '';
    this.status = '';
    this.scheduleStatus = '';
    this.paymentMode = '';
    this.sortBy = 'newest';
    this.meta.perPage = 10;
    void this.loadStudents(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage > 1) {
      void this.loadStudents(this.meta.currentPage - 1);
    }
  }

  goToNextPage(): void {
    if (this.meta.currentPage < this.meta.lastPage) {
      void this.loadStudents(this.meta.currentPage + 1);
    }
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);
    this.pageInput = page;

    if (page !== this.meta.currentPage) {
      void this.loadStudents(page);
    }
  }

  trackByStudent(_: number, student: SeminarEnrolledStudent): number {
    return student.id;
  }

  formatAmount(value: unknown): string {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
      : 'N/A';
  }

  formatDate(value: string | null | undefined): string {
    if (!value || value === '0000-00-00') {
      return 'N/A';
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    return Number.isNaN(date.getTime())
      ? 'N/A'
      : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  formatTimeRange(student: SeminarEnrolledStudent): string {
    if (!student.programStartTime) {
      return 'N/A';
    }

    return student.programEndTime
      ? `${student.programStartTime} - ${student.programEndTime}`
      : student.programStartTime;
  }

  getProgramLocationLabel(student: SeminarEnrolledStudent): string {
    return (
      student.programLocationLabel ||
      [student.programBranchName, student.programDistrictName, student.programStateName].filter(Boolean).join(', ') ||
      [student.programVenue, student.programCity].filter(Boolean).join(', ') ||
      'N/A'
    );
  }

  getProgramAddress(student: SeminarEnrolledStudent): string {
    return `${student.programBranchAddress || ''}`.trim();
  }

  getPaginationLabel(): string {
    return `Showing ${this.meta.from || 0}-${this.meta.to || 0} of ${this.meta.total} seminar enrollments`;
  }

  private buildPayload(page: number): Record<string, unknown> {
    return {
      page,
      perPage: this.meta.perPage,
      search: this.search.trim(),
      programCode: this.programCode.trim(),
      status: this.status,
      scheduleStatus: this.scheduleStatus || 'all',
      paymentMode: this.paymentMode,
      sortBy: this.sortBy,
    };
  }

  private resetResults(): void {
    this.students = [];
    this.meta = this.createDefaultMeta();
    this.summary = this.createDefaultSummary();
    this.pageInput = 1;
  }

  private createDefaultMeta(): SeminarPaginationMeta {
    return { currentPage: 1, perPage: 10, total: 0, lastPage: 1, from: null, to: null };
  }

  private createDefaultSummary(): SeminarEnrolledStudentSummary {
    return { totalEnrollments: 0, totalStudents: 0, totalPaid: 0 };
  }
}
