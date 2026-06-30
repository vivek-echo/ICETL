import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import Swal from 'sweetalert2';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { Course } from '../../services/course';
import {
  OfflineCourseEnrollmentInstallmentPayload,
  OfflineCourseEnrollmentPaymentBy,
  OfflineCourseEnrollmentPayload,
  OfflineCourseEnrollmentResponse,
  OfflineCourseItem,
  OfflineCourseListResponse,
  OfflineCoursePaginationMeta,
  OfflineCourseScheduleFilter,
  OfflineCourseSortOption,
  OfflineCourseSummary,
} from '../../services/offline-course';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';

type OfflineCourseScope = 'mine' | 'all';
type EnrollmentGender = 1 | 2 | '';
type EnrollmentCalendarTarget = 'dob' | `installment-${number}`;
type OfflineApprovalStatus = '' | 'PENDING' | 'APPROVED' | 'REJECTED';
type OfflinePublishStatus = '' | '0' | '1';

interface CourseCategoryFilter {
  id: number;
  categoryName: string;
}

interface EnrollmentCalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

interface OfflineEnrollmentInstallmentForm {
  installmentNo: number;
  amount: number;
  expectedDate: string;
  status: 'PAID' | 'PENDING';
}

interface OfflineEnrollmentForm {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: EnrollmentGender;
  paymentBy: OfflineCourseEnrollmentPaymentBy;
  transactionNo: string;
  totalFee: number;
  amountPaid: number;
  amountBalance: number;
  paidInFull: boolean;
  installments: OfflineEnrollmentInstallmentForm[];
}

@Component({
  selector: 'app-view-my-offline-course',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalWindowDirective, ModalWindowControlsComponent],
  templateUrl: './view-my-offline-course.html',
  styleUrl: './view-my-offline-course.scss',
})
export class ViewMyOfflineCourse implements OnInit {
  readonly addRoute = '/application/courses/manageOfflineCourses/add';
  readonly currentYear = new Date().getFullYear();
  readonly calendarWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly calendarMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  readonly dobCalendarYearOptions = this.buildDobCalendarYearOptions();
  readonly installmentCalendarYearOptions = this.buildInstallmentCalendarYearOptions();
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly maxInstallmentRows = 4;
  readonly sortOptions: Array<{ value: OfflineCourseSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Added' },
    { value: 'oldest', label: 'Oldest Added' },
    { value: 'dateAsc', label: 'Start Date Asc' },
    { value: 'dateDesc', label: 'Start Date Desc' },
  ];
  readonly scheduleFilters: Array<{ value: OfflineCourseScheduleFilter; label: string }> = [
    { value: '', label: 'All Timeline' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
  ];
  readonly approvalStatusOptions: Array<{ value: OfflineApprovalStatus; label: string }> = [
    { value: '', label: 'All Approval' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];
  readonly publishStatusOptions: Array<{ value: OfflinePublishStatus; label: string }> = [
    { value: '', label: 'All Publish' },
    { value: '1', label: 'Published' },
    { value: '0', label: 'Unpublished' },
  ];
  readonly createdByRoleOptions: Array<{ value: string; label: string }> = [
    { value: '', label: 'All Creator Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'team', label: 'Team' },
    { value: 'instructor', label: 'Instructor' },
  ];

  @Input() scopeOverride?: OfflineCourseScope;

  scope: OfflineCourseScope = 'mine';
  categories: CourseCategoryFilter[] = [];
  courses: OfflineCourseItem[] = [];
  loading = false;
  showFilters = false;
  search = '';
  categoryId = '';
  approvalStatus: OfflineApprovalStatus = '';
  publishStatus: OfflinePublishStatus = '';
  createdByRole = '';
  startDate = '';
  endDate = '';
  status = '';
  scheduleStatus: OfflineCourseScheduleFilter = '';
  sortBy: OfflineCourseSortOption = 'newest';
  pageInput = 1;
  meta: OfflineCoursePaginationMeta = this.createDefaultMeta();
  summary: OfflineCourseSummary = this.createDefaultSummary();
  enrollmentModalOpen = false;
  enrollmentSubmitting = false;
  selectedEnrollmentCourse: OfflineCourseItem | null = null;
  enrollmentForm: OfflineEnrollmentForm = this.createEmptyEnrollmentForm();
  enrollmentErrors: Record<string, string> = {};
  installmentLimitMessage = '';
  openEnrollmentCalendar: EnrollmentCalendarTarget | null = null;
  enrollmentCalendarViews: Record<string, Date> = {
    dob: this.defaultEnrollmentCalendarView('dob'),
  };

  private requestSerial = 0;

  constructor(
    private readonly courseService: Course,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.scope =
      this.scopeOverride ??
      (this.route.snapshot.data['offlineCourseScope'] === 'all' ? 'all' : 'mine');
    void this.loadCategories();
    void this.loadCourses();
  }

  async loadCategories(): Promise<void> {
    try {
      const response: any = await lastValueFrom(
        this.courseService.getCourseCategories({ status: '1' }).pipe(timeout(15000)),
      );

      this.categories = response?.status && Array.isArray(response.data) ? response.data : [];
    } catch {
      this.categories = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get isAllCoursesView(): boolean {
    return this.scope === 'all';
  }

  get pageTitle(): string {
    return this.isAllCoursesView ? 'All Offline Courses' : 'My Offline Courses';
  }

  get pageEyebrow(): string {
    return this.isAllCoursesView ? 'Platform Offline Catalog' : 'Offline Course Management';
  }

  get pageDescription(): string {
    return this.isAllCoursesView
      ? 'Review every classroom course across creators, venues, schedules, and publish status.'
      : 'Review classroom course schedules, venue details, and publish status from one workspace.';
  }

  get totalSummaryLabel(): string {
    return this.isAllCoursesView ? 'Courses across platform' : 'Offline courses added by you';
  }

  get dobDisplayValue(): string {
    return this.formatIsoDateForDisplay(this.enrollmentForm.dob);
  }

  get paymentByDisplayLabel(): string {
    const labels: Record<OfflineCourseEnrollmentPaymentBy, string> = {
      CASH: 'Cash',
      UPI: 'UPI',
      NETBANKING: 'Netbanking',
    };

    return labels[this.enrollmentForm.paymentBy];
  }

  @HostListener('document:click')
  closeEnrollmentCalendar(): void {
    this.openEnrollmentCalendar = null;
  }

  async loadCourses(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = (await lastValueFrom(
        this.getListRequest(page).pipe(timeout(15000)),
      )) as OfflineCourseListResponse;

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.courses = response.data || [];
        this.meta = response.meta || this.createDefaultMeta();
        this.summary = response.summary || this.createDefaultSummary();
        this.pageInput = this.meta.currentPage;

        if (this.courses.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadCourses(this.meta.currentPage - 1);
        }
      } else {
        this.resetResults();
      }
    } catch (error: any) {
      if (requestId !== this.requestSerial) {
        return;
      }

      this.resetResults();
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch offline courses.',
        'Offline Courses',
      );
    } finally {
      if (requestId === this.requestSerial) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  onSearch(): void {
    void this.loadCourses(1);
  }

  onFilterChange(): void {
    void this.loadCourses(1);
  }

  onPerPageChange(): void {
    void this.loadCourses(1);
  }

  clearFilters(): void {
    this.search = '';
    this.categoryId = '';
    this.approvalStatus = '';
    this.publishStatus = '';
    this.createdByRole = '';
    this.startDate = '';
    this.endDate = '';
    this.status = '';
    this.scheduleStatus = '';
    this.sortBy = 'newest';
    this.meta.perPage = 10;
    void this.loadCourses(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.loadCourses(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.loadCourses(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.loadCourses(page);
  }

  goToAddCourse(): void {
    void this.router.navigate([this.addRoute]);
  }

  openEnrollmentModal(course: OfflineCourseItem): void {
    if (!this.isAllCoursesView) {
      return;
    }

    const totalFee = this.toMoney(course.price);
    this.selectedEnrollmentCourse = course;
    this.enrollmentForm = this.createEmptyEnrollmentForm(totalFee);
    this.enrollmentForm.paidInFull = totalFee === 0;
    this.enrollmentForm.amountPaid = this.enrollmentForm.paidInFull ? totalFee : 0;
    this.enrollmentCalendarViews = {
      dob: this.defaultEnrollmentCalendarView('dob'),
    };
    this.openEnrollmentCalendar = null;
    this.recalculateEnrollmentPlan();
    this.enrollmentErrors = {};
    this.installmentLimitMessage = '';
    this.enrollmentSubmitting = false;
    this.enrollmentModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEnrollmentModal(force = false): void {
    if (this.enrollmentSubmitting && !force) {
      return;
    }

    this.enrollmentModalOpen = false;
    this.selectedEnrollmentCourse = null;
    this.enrollmentForm = this.createEmptyEnrollmentForm();
    this.enrollmentErrors = {};
    this.installmentLimitMessage = '';
    this.openEnrollmentCalendar = null;
  }

  onEnrollmentAmountPaidChange(): void {
    this.enrollmentForm.amountPaid = this.toMoney(this.enrollmentForm.amountPaid);
    this.enrollmentForm.paidInFull = false;
    this.recalculateEnrollmentPlan();
    this.clearEnrollmentErrors(['amountPaid', 'amountBalance', 'installments']);
  }

  onPaidInFullChange(): void {
    if (this.enrollmentForm.paidInFull) {
      this.enrollmentForm.amountPaid = this.enrollmentForm.totalFee;
    } else if (this.enrollmentForm.amountPaid >= this.enrollmentForm.totalFee) {
      this.enrollmentForm.amountPaid = 0;
    }

    this.recalculateEnrollmentPlan();
    this.clearEnrollmentErrors(['paidInFull', 'amountPaid', 'amountBalance', 'installments']);
  }

  onPaymentByChange(): void {
    this.clearEnrollmentErrors(['paymentBy', 'transactionNo']);
  }

  onTransactionNoChange(): void {
    this.clearEnrollmentErrors(['transactionNo']);
  }

  sanitizeEnrollmentPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '').slice(0, 10);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.enrollmentForm.phone = sanitized;
    this.clearEnrollmentErrors(['phone']);
  }

  keepEnrollmentCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  calendarTargetForInstallment(index: number): EnrollmentCalendarTarget {
    return `installment-${index}` as EnrollmentCalendarTarget;
  }

  getEnrollmentDateDisplay(value: string): string {
    return this.formatIsoDateForDisplay(value);
  }

  getEnrollmentCalendarView(target: EnrollmentCalendarTarget): Date {
    if (!this.enrollmentCalendarViews[target]) {
      this.enrollmentCalendarViews[target] = this.defaultEnrollmentCalendarView(target);
    }

    if (target !== 'dob') {
      this.enrollmentCalendarViews[target] = this.clampInstallmentCalendarView(
        this.enrollmentCalendarViews[target],
      );
    }

    return this.enrollmentCalendarViews[target];
  }

  getEnrollmentCalendarDays(target: EnrollmentCalendarTarget): EnrollmentCalendarDay[] {
    const selectedIso = this.getEnrollmentCalendarValue(target);
    const todayIso = this.toIsoDate(new Date());
    const calendarView = this.getEnrollmentCalendarView(target);
    const firstOfMonth = new Date(calendarView.getFullYear(), calendarView.getMonth(), 1);
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const iso = this.toIsoDate(date);

      return {
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === calendarView.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: this.isEnrollmentCalendarDayDisabled(target, iso, todayIso),
      };
    });
  }

  toggleEnrollmentCalendar(target: EnrollmentCalendarTarget, event: Event): void {
    event.stopPropagation();

    if (this.openEnrollmentCalendar !== target) {
      this.syncEnrollmentCalendarView(target);
    }

    this.openEnrollmentCalendar = this.openEnrollmentCalendar === target ? null : target;
  }

  changeEnrollmentCalendarMonth(target: EnrollmentCalendarTarget, offset: number): void {
    const currentView = this.getEnrollmentCalendarView(target);
    const nextView = new Date(currentView.getFullYear(), currentView.getMonth() + offset, 1);

    this.enrollmentCalendarViews = {
      ...this.enrollmentCalendarViews,
      [target]: target === 'dob' ? nextView : this.clampInstallmentCalendarView(nextView),
    };
  }

  setEnrollmentCalendarMonth(target: EnrollmentCalendarTarget, event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    const currentView = this.getEnrollmentCalendarView(target);
    const nextView = new Date(currentView.getFullYear(), month, 1);

    this.enrollmentCalendarViews = {
      ...this.enrollmentCalendarViews,
      [target]: target === 'dob' ? nextView : this.clampInstallmentCalendarView(nextView),
    };
  }

  setEnrollmentCalendarYear(target: EnrollmentCalendarTarget, event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    const currentView = this.getEnrollmentCalendarView(target);
    const nextView = new Date(year, currentView.getMonth(), 1);

    this.enrollmentCalendarViews = {
      ...this.enrollmentCalendarViews,
      [target]: target === 'dob' ? nextView : this.clampInstallmentCalendarView(nextView),
    };
  }

  isEnrollmentPreviousMonthDisabled(target: EnrollmentCalendarTarget): boolean {
    if (target === 'dob') {
      return false;
    }

    const view = this.getEnrollmentCalendarView(target);
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonth = new Date(view.getFullYear(), view.getMonth() - 1, 1);

    return previousMonth < currentMonth;
  }

  selectEnrollmentCalendarDate(target: EnrollmentCalendarTarget, day: EnrollmentCalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    if (target === 'dob') {
      this.enrollmentForm.dob = day.iso;
      this.clearEnrollmentErrors(['dob']);
    } else {
      const index = this.installmentIndexFromCalendarTarget(target);
      const installment = this.enrollmentForm.installments[index];

      if (installment && installment.status === 'PENDING') {
        installment.expectedDate = day.iso;
        this.clearEnrollmentErrors([`installments.${index}.expectedDate`, 'installments']);
      }
    }

    this.openEnrollmentCalendar = null;
  }

  clearEnrollmentCalendarDate(target: EnrollmentCalendarTarget, event: Event): void {
    event.stopPropagation();

    if (target === 'dob') {
      this.enrollmentForm.dob = '';
      this.clearEnrollmentErrors(['dob']);
    } else {
      const index = this.installmentIndexFromCalendarTarget(target);
      const installment = this.enrollmentForm.installments[index];

      if (installment && installment.status === 'PENDING') {
        installment.expectedDate = '';
      }
    }

    this.syncEnrollmentCalendarView(target);
  }

  addPendingInstallment(): void {
    if (this.enrollmentForm.installments.length >= this.maxInstallmentRows) {
      this.installmentLimitMessage = 'Maximum 4 installment rows are allowed.';
      return;
    }

    this.enrollmentForm.installments.push({
      installmentNo: this.enrollmentForm.installments.length + 1,
      amount: 0,
      expectedDate: '',
      status: 'PENDING',
    });
    this.installmentLimitMessage = '';
    this.recalculateInstallments();
    this.clearEnrollmentErrors(['installments']);
  }

  removePendingInstallment(index: number): void {
    const row = this.enrollmentForm.installments[index];

    if (!row || row.status === 'PAID' || this.pendingInstallmentCount <= 1) {
      return;
    }

    this.enrollmentForm.installments.splice(index, 1);
    this.installmentLimitMessage = '';
    this.recalculateInstallments();
    this.clearEnrollmentErrors(['installments']);
  }

  get pendingInstallmentCount(): number {
    return this.enrollmentForm.installments.filter((installment) => installment.status === 'PENDING')
      .length;
  }

  getEnrollmentError(field: string): string {
    return this.enrollmentErrors[field] || '';
  }

  async submitEnrollment(): Promise<void> {
    if (!this.selectedEnrollmentCourse || this.enrollmentSubmitting) {
      return;
    }

    this.recalculateEnrollmentPlan();

    if (!this.validateEnrollmentForm()) {
      return;
    }

    this.enrollmentSubmitting = true;

    try {
      const response = (await lastValueFrom(
        this.courseService
          .enrollOfflineCourseStudent(this.buildEnrollmentPayload(this.selectedEnrollmentCourse))
          .pipe(timeout(15000)),
      )) as OfflineCourseEnrollmentResponse;

      if (response.status) {
        const invoiceNumber = response.data?.invoiceNumber
          ? ` Invoice: ${response.data.invoiceNumber}`
          : '';
        const courseCode = response.data?.courseCode ? ` Code: ${response.data.courseCode}` : '';
        this.closeEnrollmentModal(true);
        await this.alertHelper.success(
          `${response.message || 'Student enrolled successfully.'}${invoiceNumber}${courseCode}`,
          'Offline Enrollment',
        );
      } else {
        await this.alertHelper.error(
          response.message || 'Unable to enroll student.',
          'Offline Enrollment',
        );
      }
    } catch (error: any) {
      const apiErrors = this.extractApiErrors(error?.error?.errors);
      this.enrollmentErrors = {
        ...this.enrollmentErrors,
        ...apiErrors,
      };
      await this.alertHelper.error(
        this.firstApiMessage(apiErrors) ||
          error?.error?.message ||
          'Unable to enroll student.',
        'Offline Enrollment',
      );
    } finally {
      this.enrollmentSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  async deleteCourse(course: OfflineCourseItem): Promise<void> {
    if (this.isAllCoursesView) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Do you want to delete "${course.title}"?`,
      'Delete Offline Course',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService.deleteOfflineCourse({ id: course.id }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadCourses(this.meta.currentPage);
        await this.alertHelper.success(response.message || 'Offline course deleted successfully.');
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to delete offline course.',
        'Delete Offline Course',
      );
    }
  }

  async toggleStatus(course: OfflineCourseItem): Promise<void> {
    await this.publishCourse(course, !this.isPublished(course));
  }

  async viewCourse(course: OfflineCourseItem): Promise<void> {
    const primaryCourse = this.getPrimaryCourseLabel(course);
    const html = `
      <div class="offline-course-swal-detail">
        <p><strong>Code:</strong> ${this.escapeHtml(course.code || 'N/A')}</p>
        <p><strong>Category:</strong> ${this.escapeHtml(course.categoryName || 'Uncategorized')}</p>
        <p><strong>Instructor:</strong> ${this.escapeHtml(course.instructorName || 'Instructor')}</p>
        <p><strong>Venue:</strong> ${this.escapeHtml(course.venue || 'N/A')}</p>
        <p><strong>Schedule:</strong> ${this.escapeHtml(this.formatDateRange(course))}</p>
        <p><strong>Approval:</strong> ${this.escapeHtml(this.getApprovalStatusLabel(course))}</p>
        <p><strong>Publish:</strong> ${this.escapeHtml(this.getPublishStatusLabel(course))}</p>
        ${primaryCourse ? `<p><strong>Primary Course:</strong> ${this.escapeHtml(primaryCourse)}</p>` : ''}
        ${course.rejectionReason ? `<p><strong>Rejection Reason:</strong> ${this.escapeHtml(course.rejectionReason)}</p>` : ''}
      </div>
    `;

    await this.alertHelper.viewAlertHtml('info', course.title || 'Offline Course', html);
  }

  editCourse(course: OfflineCourseItem): void {
    if (!this.canEdit(course)) {
      return;
    }

    void this.router.navigate([this.addRoute], {
      state: {
        offlineCourseId: course.id,
      },
    });
  }

  async approveCourse(course: OfflineCourseItem): Promise<void> {
    if (!this.canApprove(course)) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Approve "${course.title}"?`,
      'Approve Offline Course',
      'Approve',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService.approveOfflineCourse({ id: course.id }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Offline course approved successfully.');
        await this.loadCourses(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to approve offline course.',
        'Approve Offline Course',
      );
    }
  }

  async rejectCourse(course: OfflineCourseItem): Promise<void> {
    if (!this.canReject(course)) {
      return;
    }

    const result = await Swal.fire({
      width: '36rem',
      icon: 'warning',
      title: 'Reject Offline Course',
      input: 'textarea',
      inputLabel: `Reason for rejecting "${course.title}"`,
      inputPlaceholder: 'Enter rejection reason',
      inputAttributes: {
        maxlength: '500',
      },
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        const reason = `${value || ''}`.trim();

        if (!reason) {
          return 'Rejection reason is required.';
        }

        if (reason.length < 5) {
          return 'Rejection reason must be at least 5 characters.';
        }

        return null;
      },
    });

    const rejectionReason = `${result.value || ''}`.trim();

    if (!result.isConfirmed || !rejectionReason) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService
          .rejectOfflineCourse({ id: course.id, rejectionReason })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Offline course rejected successfully.');
        await this.loadCourses(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to reject offline course.',
        'Reject Offline Course',
      );
    }
  }

  async publishCourse(course: OfflineCourseItem, shouldPublish: boolean): Promise<void> {
    if (shouldPublish && this.getApprovalStatus(course) !== 'APPROVED') {
      await this.alertHelper.warning(
        'This offline course must be approved before it can be published.',
        'Publish Offline Course',
      );
      return;
    }

    if (shouldPublish ? !this.canPublish(course) : !this.canUnpublish(course)) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Do you want to ${shouldPublish ? 'publish' : 'unpublish'} "${course.title}"?`,
      shouldPublish ? 'Publish Offline Course' : 'Unpublish Offline Course',
      shouldPublish ? 'Publish' : 'Unpublish',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService
          .publishOfflineCourse({ id: course.id, publishedFlag: shouldPublish ? 1 : 0 })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        await this.alertHelper.success(
          response.message ||
            `Offline course ${shouldPublish ? 'published' : 'unpublished'} successfully.`,
        );
        await this.loadCourses(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message ||
          `Unable to ${shouldPublish ? 'publish' : 'unpublish'} offline course.`,
        shouldPublish ? 'Publish Offline Course' : 'Unpublish Offline Course',
      );
    }
  }

  trackByCourseId(_: number, course: OfflineCourseItem): number {
    return course.id;
  }

  isActive(course: OfflineCourseItem): boolean {
    return Number(course.status) === 1;
  }

  isPublished(course: OfflineCourseItem): boolean {
    const publishedValue = course.publishedFlag ?? course.publishStatus ?? course.status;

    return publishedValue === true || Number(publishedValue) === 1;
  }

  getApprovalStatus(course: OfflineCourseItem): 'PENDING' | 'APPROVED' | 'REJECTED' {
    const status = `${course.approvalStatus || 'PENDING'}`.toUpperCase();

    return status === 'APPROVED' || status === 'REJECTED' ? status : 'PENDING';
  }

  getApprovalStatusLabel(course: OfflineCourseItem): string {
    return course.approvalStatusLabel || this.toTitleCase(this.getApprovalStatus(course));
  }

  getPublishStatusLabel(course: OfflineCourseItem): string {
    return course.publishStatusLabel || (this.isPublished(course) ? 'Published' : 'Unpublished');
  }

  getApprovalBadgeClass(course: OfflineCourseItem): string {
    return `offline-status-badge--${this.getApprovalStatus(course).toLowerCase()}`;
  }

  getPublishBadgeClass(course: OfflineCourseItem): string {
    return this.isPublished(course)
      ? 'offline-status-badge--published'
      : 'offline-status-badge--unpublished';
  }

  canView(course: OfflineCourseItem): boolean {
    return course.actions?.view !== false;
  }

  canEdit(course: OfflineCourseItem): boolean {
    return !!course.actions?.edit;
  }

  canApprove(course: OfflineCourseItem): boolean {
    return !!course.actions?.approve;
  }

  canReject(course: OfflineCourseItem): boolean {
    return !!course.actions?.reject;
  }

  canPublish(course: OfflineCourseItem): boolean {
    return !!course.actions?.publish;
  }

  canUnpublish(course: OfflineCourseItem): boolean {
    return !!course.actions?.unpublish;
  }

  isSpecialCourse(course: OfflineCourseItem): boolean {
    return course.isSpecial === true || Number(course.isSpecial ?? 0) === 1;
  }

  getPrimaryCourseLabel(course: OfflineCourseItem): string {
    const title = `${course.parentCourseTitle || ''}`.trim();
    const code = `${course.parentCourseCode || ''}`.trim();

    if (title && code) {
      return `${title} (${code})`;
    }

    return title || code;
  }

  getInitial(course: OfflineCourseItem): string {
    return course.instructorName?.trim()?.charAt(0)?.toUpperCase() || 'I';
  }

  getCreatorInitial(course: OfflineCourseItem): string {
    return course.createdByName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }

  getScheduleLabel(course: OfflineCourseItem): string {
    if (course.scheduleStatus === 'completed') {
      return 'Completed';
    }

    return course.scheduleStatus === 'ongoing' ? 'Ongoing' : 'Upcoming';
  }

  formatPrice(value: number | string | null): string {
    const price = Number(value);

    if (!Number.isFinite(price)) {
      return 'N/A';
    }

    if (price === 0) {
      return 'Free';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
    }).format(price);
  }

  formatDateRange(course: OfflineCourseItem): string {
    if (!course.startDate) {
      return 'N/A';
    }

    const startDate = this.formatDate(course.startDate);

    if (!course.endDate || course.endDate === course.startDate) {
      return startDate;
    }

    return `${startDate} - ${this.formatDate(course.endDate)}`;
  }

  formatDateValue(value: string | null | undefined): string {
    return value ? this.formatDate(value) : 'N/A';
  }

  formatTimeRange(course: OfflineCourseItem): string {
    if (!course.startTime) {
      return 'N/A';
    }

    return course.endTime ? `${course.startTime} - ${course.endTime}` : course.startTime;
  }

  getExternalLinkUrl(value: string | null): string {
    const link = `${value || ''}`.trim();

    if (!link) {
      return '#';
    }

    return /^https?:\/\//i.test(link) ? link : `https://${link}`;
  }

  getHighlights(course: OfflineCourseItem, limit = 3): string[] {
    const highlights = Array.isArray(course.highlights)
      ? course.highlights
      : Array.isArray(course.courseHighlights)
        ? course.courseHighlights
        : [];

    return highlights.slice(0, limit);
  }

  getPaginationLabel(): string {
    const from = this.meta.from ?? 0;
    const to = this.meta.to ?? 0;

    return `Showing ${from}-${to} of ${this.meta.total} offline courses`;
  }

  private toTitleCase(value: string): string {
    return `${value || ''}`
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private escapeHtml(value: string): string {
    return `${value}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private createEmptyEnrollmentForm(totalFee = 0): OfflineEnrollmentForm {
    return {
      name: '',
      email: '',
      phone: '',
      dob: '',
      gender: '',
      paymentBy: 'CASH',
      transactionNo: '',
      totalFee: this.toMoney(totalFee),
      amountPaid: 0,
      amountBalance: this.toMoney(totalFee),
      paidInFull: false,
      installments: [],
    };
  }

  private syncEnrollmentCalendarView(target: EnrollmentCalendarTarget): void {
    const selectedDate = this.parseIsoDate(this.getEnrollmentCalendarValue(target));
    const viewDate = selectedDate || this.defaultEnrollmentCalendarView(target);
    const nextView = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);

    this.enrollmentCalendarViews = {
      ...this.enrollmentCalendarViews,
      [target]: target === 'dob' ? nextView : this.clampInstallmentCalendarView(nextView),
    };
  }

  private getEnrollmentCalendarValue(target: EnrollmentCalendarTarget): string {
    if (target === 'dob') {
      return this.enrollmentForm.dob;
    }

    const installment = this.enrollmentForm.installments[this.installmentIndexFromCalendarTarget(target)];

    return installment?.expectedDate || '';
  }

  private installmentIndexFromCalendarTarget(target: EnrollmentCalendarTarget): number {
    return Number(`${target}`.replace('installment-', ''));
  }

  private isEnrollmentCalendarDayDisabled(
    target: EnrollmentCalendarTarget,
    iso: string,
    todayIso: string,
  ): boolean {
    if (target === 'dob') {
      return iso > todayIso;
    }

    return iso < todayIso;
  }

  private defaultEnrollmentCalendarView(target: EnrollmentCalendarTarget): Date {
    const today = new Date();

    if (target === 'dob') {
      return new Date(this.currentYear - 20, today.getMonth(), 1);
    }

    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  private buildDobCalendarYearOptions(): number[] {
    return Array.from({ length: 91 }, (_, index) => this.currentYear - 80 + index);
  }

  private buildInstallmentCalendarYearOptions(): number[] {
    return Array.from({ length: 11 }, (_, index) => this.currentYear + index);
  }

  private clampInstallmentCalendarView(value: Date): Date {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const viewMonth = new Date(value.getFullYear(), value.getMonth(), 1);

    return viewMonth < currentMonth ? currentMonth : viewMonth;
  }

  private recalculateEnrollmentPlan(): void {
    this.enrollmentForm.totalFee = this.toMoney(this.enrollmentForm.totalFee);
    this.enrollmentForm.amountPaid = this.toMoney(
      Math.max(this.toMoney(this.enrollmentForm.amountPaid), 0),
    );

    this.enrollmentForm.amountBalance = this.toMoney(
      Math.max(this.enrollmentForm.totalFee - this.enrollmentForm.amountPaid, 0),
    );
    this.enrollmentForm.paidInFull =
      this.enrollmentForm.totalFee <= 0 ||
      this.enrollmentForm.amountPaid === this.enrollmentForm.totalFee;

    if (this.enrollmentForm.amountBalance <= 0) {
      this.enrollmentForm.installments = [];
      this.installmentLimitMessage = '';
      return;
    }

    if (this.enrollmentForm.installments.length === 0) {
      this.enrollmentForm.installments = [
        {
          installmentNo: 1,
          amount: this.enrollmentForm.amountPaid,
          expectedDate: '',
          status: 'PAID',
        },
        {
          installmentNo: 2,
          amount: this.enrollmentForm.amountBalance,
          expectedDate: '',
          status: 'PENDING',
        },
      ];
    }

    this.recalculateInstallments();
  }

  private recalculateInstallments(): void {
    const paidRow =
      this.enrollmentForm.installments.find((installment) => installment.status === 'PAID') ||
      this.enrollmentForm.installments[0];

    if (paidRow) {
      paidRow.status = 'PAID';
      paidRow.amount = this.enrollmentForm.amountPaid;
      paidRow.expectedDate = '';
    }

    const pendingRows = this.enrollmentForm.installments.filter(
      (installment) => installment.status === 'PENDING',
    );

    if (pendingRows.length === 0 && this.enrollmentForm.amountBalance > 0) {
      this.enrollmentForm.installments.push({
        installmentNo: this.enrollmentForm.installments.length + 1,
        amount: this.enrollmentForm.amountBalance,
        expectedDate: '',
        status: 'PENDING',
      });
    }

    const refreshedPendingRows = this.enrollmentForm.installments.filter(
      (installment) => installment.status === 'PENDING',
    );
    let remaining = this.enrollmentForm.amountBalance;
    const baseAmount =
      refreshedPendingRows.length > 0
        ? this.toMoney(this.enrollmentForm.amountBalance / refreshedPendingRows.length)
        : 0;

    refreshedPendingRows.forEach((installment, index) => {
      installment.amount =
        index === refreshedPendingRows.length - 1 ? this.toMoney(remaining) : baseAmount;
      remaining = this.toMoney(remaining - installment.amount);
    });

    this.enrollmentForm.installments = this.enrollmentForm.installments.map(
      (installment, index) => ({
        ...installment,
        installmentNo: index + 1,
      }),
    );
  }

  private validateEnrollmentForm(): boolean {
    const errors: Record<string, string> = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!this.enrollmentForm.name.trim()) {
      errors['name'] = 'Name is required.';
    }

    if (!this.enrollmentForm.email.trim()) {
      errors['email'] = 'Email is required.';
    } else if (!emailPattern.test(this.enrollmentForm.email.trim())) {
      errors['email'] = 'Enter a valid email address.';
    }

    if (!/^\d{10}$/.test(this.enrollmentForm.phone.trim())) {
      errors['phone'] = 'Enter a valid 10 digit mobile number.';
    }

    if (!this.enrollmentForm.dob) {
      errors['dob'] = 'DOB is required.';
    }

    if (!this.enrollmentForm.gender) {
      errors['gender'] = 'Gender is required.';
    }

    if (!this.enrollmentForm.paymentBy) {
      errors['paymentBy'] = 'Payment by is required.';
    }

    if (
      this.enrollmentForm.paymentBy !== 'CASH' &&
      !this.enrollmentForm.transactionNo.trim()
    ) {
      errors['transactionNo'] = 'Transaction no is required for UPI and Netbanking.';
    }

    if (!Number.isFinite(this.enrollmentForm.totalFee) || this.enrollmentForm.totalFee < 0) {
      errors['totalFee'] = 'Total fee is required.';
    }

    if (!Number.isFinite(this.enrollmentForm.amountPaid) || this.enrollmentForm.amountPaid < 0) {
      errors['amountPaid'] = 'Amount paid is required and must be 0 or more.';
    } else if (this.enrollmentForm.amountPaid > this.enrollmentForm.totalFee) {
      errors['amountPaid'] = 'Amount paid cannot be greater than total fee.';
    }

    if (this.enrollmentForm.amountBalance > 0) {
      const pendingRows = this.enrollmentForm.installments.filter(
        (installment) => installment.status === 'PENDING',
      );

      if (this.enrollmentForm.installments.length === 0 || pendingRows.length === 0) {
        errors['installments'] = 'Add at least one pending installment.';
      }

      this.enrollmentForm.installments.forEach((installment, index) => {
        if (installment.status === 'PENDING' && !installment.expectedDate) {
          errors[`installments.${index}.expectedDate`] = 'Expected date is required.';
        }
      });
    }

    this.enrollmentErrors = errors;

    return Object.keys(errors).length === 0;
  }

  private buildEnrollmentPayload(course: OfflineCourseItem): OfflineCourseEnrollmentPayload {
    return {
      courseId: course.id,
      name: this.enrollmentForm.name.trim(),
      email: this.enrollmentForm.email.trim().toLowerCase(),
      phone: this.enrollmentForm.phone.trim(),
      dob: this.enrollmentForm.dob,
      gender: this.enrollmentForm.gender as 1 | 2,
      paymentBy: this.enrollmentForm.paymentBy,
      transactionNo: this.enrollmentForm.transactionNo.trim() || null,
      totalFee: this.enrollmentForm.totalFee,
      amountPaid: this.enrollmentForm.amountPaid,
      amountBalance: this.enrollmentForm.amountBalance,
      paidInFull: this.enrollmentForm.paidInFull,
      installments:
        this.enrollmentForm.amountBalance > 0
          ? this.enrollmentForm.installments.map(
              (installment): OfflineCourseEnrollmentInstallmentPayload => ({
                installmentNo: installment.installmentNo,
                amount: installment.amount,
                expectedDate: installment.status === 'PAID' ? null : installment.expectedDate,
                status: installment.status,
              }),
            )
          : [],
    };
  }

  private extractApiErrors(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce(
      (errors, [key, messages]) => {
        if (Array.isArray(messages) && messages.length > 0) {
          errors[key] = `${messages[0]}`;
        } else if (typeof messages === 'string') {
          errors[key] = messages;
        }

        return errors;
      },
      {} as Record<string, string>,
    );
  }

  private firstApiMessage(errors: Record<string, string>): string {
    return Object.values(errors)[0] || '';
  }

  private clearEnrollmentErrors(fields: string[]): void {
    fields.forEach((field) => {
      delete this.enrollmentErrors[field];
    });
  }

  private toMoney(value: number | string | null | undefined): number {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.round(amount * 100) / 100;
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const isSameDate =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

    return isSameDate ? date : null;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatIsoDateForDisplay(value: string): string {
    const date = this.parseIsoDate(value);

    if (!date) {
      return '';
    }

    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');

    return `${day}-${month}-${date.getFullYear()}`;
  }

  private getListRequest(page: number) {
    const payload = {
      page,
      perPage: this.meta.perPage,
      search: this.search.trim(),
      categoryId: this.categoryId,
      approvalStatus: this.approvalStatus,
      publishStatus: this.publishStatus,
      createdByRole: this.createdByRole,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      scheduleStatus: this.scheduleStatus || 'all',
      sortBy: this.sortBy,
    };

    return this.isAllCoursesView
      ? this.courseService.getAllOfflineCourses(payload)
      : this.courseService.getMyOfflineCourses(payload);
  }

  private resetResults(): void {
    this.courses = [];
    this.meta = this.createDefaultMeta();
    this.summary = this.createDefaultSummary();
    this.pageInput = 1;
  }

  private createDefaultMeta(): OfflineCoursePaginationMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createDefaultSummary(): OfflineCourseSummary {
    return {
      totalCourses: 0,
      activeCourses: 0,
      inactiveCourses: 0,
      upcomingCourses: 0,
      ongoingCourses: 0,
      completedCourses: 0,
    };
  }

  private formatDate(value: string): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}
