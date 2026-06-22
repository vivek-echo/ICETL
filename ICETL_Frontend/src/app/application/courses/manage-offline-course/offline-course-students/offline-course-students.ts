import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  type FormGroup,
} from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { Course } from '../../services/course';
import {
  OfflineCourseEnrollmentInstallmentStatus,
  OfflineCourseInstallmentPayPayload,
  OfflineCourseInstallmentUpdatePayload,
  OfflineCoursePaginationMeta,
  OfflineCourseStudentInstallment,
  OfflineCourseStudentItem,
  OfflineCourseStudentsResponse,
  OfflineCourseStudentSummary,
  OfflineInstallmentPaymentType,
} from '../../services/offline-course';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';

type PaymentStatusFilter = '' | 'PAID' | 'PARTIAL';
type InstallmentStatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'none';
type StudentSortOption = 'nextInstallment' | 'newest' | 'paidDesc' | 'balanceDesc';

interface InstallmentDraft {
  id: number | null;
  installmentNo: number;
  amount: number;
  expectedDate: string;
  paidDate: string;
  paymentBy: OfflineInstallmentPaymentType | '';
  transactionNo: string;
  status: OfflineCourseEnrollmentInstallmentStatus;
  isOverdue?: boolean;
}

interface InstallmentCalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-offline-course-students',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './offline-course-students.html',
  styleUrl: './offline-course-students.scss',
})
export class OfflineCourseStudents implements OnInit {
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly maxInstallmentRows = 4;
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
    'December'
  ];
  readonly installmentCalendarYearOptions = this.buildInstallmentCalendarYearOptions();
  readonly installmentFilters: Array<{ value: InstallmentStatusFilter; label: string }> = [
    { value: 'all', label: 'All Installments' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'paid', label: 'Paid' },
    { value: 'none', label: 'No Schedule' },
  ];
  readonly sortOptions: Array<{ value: StudentSortOption; label: string }> = [
    { value: 'nextInstallment', label: 'Upcoming First' },
    { value: 'newest', label: 'Newest Enrolled' },
    { value: 'paidDesc', label: 'Paid Amount' },
    { value: 'balanceDesc', label: 'Balance Amount' },
  ];
  readonly paymentByOptions: Array<{ value: OfflineInstallmentPaymentType; label: string }> = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'CARD', label: 'Card' },
    { value: 'OTHER', label: 'Other' },
  ];

  students: OfflineCourseStudentItem[] = [];
  loading = false;
  savingInstallments = false;
  search = '';
  courseCode = '';
  paymentStatus: PaymentStatusFilter = '';
  installmentStatus: InstallmentStatusFilter = 'all';
  sortBy: StudentSortOption = 'nextInstallment';
  pageInput = 1;
  meta: OfflineCoursePaginationMeta = this.createDefaultMeta();
  summary: OfflineCourseStudentSummary = this.createDefaultSummary();
  selectedStudent: OfflineCourseStudentItem | null = null;
  installmentDraft: InstallmentDraft[] = [];
  installmentErrors: Record<string, string> = {};
  paymentModalOpen = false;
  payModalOpen = false;
  paymentSubmitting = false;
  selectedInstallment: OfflineCourseStudentInstallment | null = null;
  payForm: FormGroup;
  openInstallmentCalendar: number | null = null;
  installmentCalendarViews: Record<number, Date> = {};

  private requestSerial = 0;

  constructor(
    private readonly courseService: Course,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
  ) {
    this.payForm = this.fb.group(
      {
        paymentDate: [this.toIsoDate(new Date()), Validators.required],
        paymentType: ['CASH', Validators.required],
        transactionNo: [''],
        amountPaid: [0, [Validators.required, Validators.min(0.01)]],
        remarks: [''],
      },
      {
        validators: [
          this.installmentTransactionValidator.bind(this),
          this.installmentAmountValidator.bind(this),
        ],
      },
    );
  }

  ngOnInit(): void {
    void this.loadStudents();
  }

  get nextDueDate(): string | null {
    return this.summary.nextUpcomingInstallmentDate || this.summary.nextInstallmentDate;
  }

  get draftPaidTotal(): number {
    return this.toMoney(
      this.installmentDraft
        .filter((installment) => installment.status === 'PAID')
        .reduce((sum, installment) => sum + this.toMoney(installment.amount), 0),
    );
  }

  get draftTotal(): number {
    return this.toMoney(
      this.installmentDraft.reduce((sum, installment) => sum + this.toMoney(installment.amount), 0),
    );
  }

  get draftBalance(): number {
    return this.toMoney(Math.max((this.selectedStudent?.totalFee || 0) - this.draftPaidTotal, 0));
  }

  get canSaveInstallments(): boolean {
    return Boolean(this.selectedStudent?.paymentLogId) && this.installmentDraft.length > 0;
  }

  get selectedInstallmentPendingAmount(): number {
    return this.getInstallmentBalanceAmount(this.selectedInstallment);
  }

  get shouldShowTransactionField(): boolean {
    return this.payForm.get('paymentType')?.value !== 'CASH';
  }

  @HostListener('document:click')
  closeInstallmentCalendar(): void {
    this.openInstallmentCalendar = null;
  }

  async loadStudents(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = (await lastValueFrom(
        this.courseService.getOfflineCourseEnrolledStudents(this.buildListPayload(page)).pipe(timeout(15000)),
      )) as OfflineCourseStudentsResponse;

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
    } catch (error: any) {
      if (requestId !== this.requestSerial) {
        return;
      }

      this.resetResults();
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch offline course students.',
        'Offline Course Students',
      );
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

  onPerPageChange(): void {
    void this.loadStudents(1);
  }

  clearFilters(): void {
    this.search = '';
    this.courseCode = '';
    this.paymentStatus = '';
    this.installmentStatus = 'all';
    this.sortBy = 'nextInstallment';
    this.meta.perPage = 10;
    void this.loadStudents(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.loadStudents(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.loadStudents(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);
    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.loadStudents(page);
  }

  openPaymentDetails(student: OfflineCourseStudentItem): void {
    this.selectedStudent = student;
    this.installmentDraft = this.toInstallmentDraft(student.installments, student);
    this.installmentErrors = {};
    this.openInstallmentCalendar = null;
    this.installmentCalendarViews = {};
    this.paymentModalOpen = true;
  }

  closePaymentDetails(force = false): void {
    if ((this.savingInstallments || this.paymentSubmitting) && !force) {
      return;
    }

    this.closeInstallmentPayment(true);
    this.paymentModalOpen = false;
    this.selectedStudent = null;
    this.installmentDraft = [];
    this.installmentErrors = {};
    this.openInstallmentCalendar = null;
    this.installmentCalendarViews = {};
  }

  addInstallment(): void {
    if (this.installmentDraft.length >= this.maxInstallmentRows) {
      this.installmentErrors['installments'] = 'Maximum 4 installment rows are allowed.';
      return;
    }

    this.installmentDraft.push({
      id: null,
      installmentNo: this.installmentDraft.length + 1,
      amount: 0,
      expectedDate: '',
      paidDate: '',
      paymentBy: '',
      transactionNo: '',
      status: 'PENDING',
    });
    this.renumberInstallments();
    this.clearInstallmentErrors(['installments']);
  }

  removeInstallment(index: number): void {
    if (this.installmentDraft.length <= 1 || this.savingInstallments) {
      return;
    }

    this.installmentDraft.splice(index, 1);
    this.renumberInstallments();
    this.clearInstallmentErrors(['installments', `installments.${index}.amount`, `installments.${index}.expectedDate`]);
  }

  onInstallmentAmountChange(index: number): void {
    const installment = this.installmentDraft[index];

    if (!installment) {
      return;
    }

    installment.amount = this.toMoney(installment.amount);
    this.clearInstallmentErrors(['installments', `installments.${index}.amount`]);
  }

  onInstallmentStatusChange(index: number): void {
    const installment = this.installmentDraft[index];

    if (!installment) {
      return;
    }

    if (installment.status === 'PAID') {
      installment.paidDate = installment.paidDate || this.toIsoDate(new Date());
      installment.paymentBy = installment.paymentBy || 'CASH';
    } else {
      installment.paidDate = '';
      installment.paymentBy = '';
      installment.transactionNo = '';
    }

    this.clearInstallmentErrors([
      'installments',
      `installments.${index}.expectedDate`,
      `installments.${index}.paymentBy`,
      `installments.${index}.transactionNo`,
    ]);
  }

  onInstallmentPaymentByChange(index: number): void {
    const installment = this.installmentDraft[index];

    if (!installment) {
      return;
    }

    if (installment.paymentBy === 'CASH') {
      installment.transactionNo = '';
    }

    this.clearInstallmentErrors([
      `installments.${index}.paymentBy`,
      `installments.${index}.transactionNo`,
    ]);
  }

  onInstallmentTransactionNoChange(index: number): void {
    this.clearInstallmentErrors([`installments.${index}.transactionNo`]);
  }

  async saveInstallments(): Promise<void> {
    if (!this.selectedStudent?.paymentLogId || !this.validateInstallments()) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Update this payment schedule and recalculated balance?',
      'Update Installments',
      'Update',
    );

    if (!confirmed || !this.selectedStudent?.paymentLogId) {
      return;
    }

    this.savingInstallments = true;

    try {
      const payload: OfflineCourseInstallmentUpdatePayload = {
        paymentLogId: this.selectedStudent.paymentLogId,
        installments: this.installmentDraft.map((installment, index) => ({
          id: installment.id,
          installmentNo: index + 1,
          amount: this.toMoney(installment.amount),
          expectedDate: installment.expectedDate || null,
          paidDate: installment.status === 'PAID' ? installment.paidDate || this.toIsoDate(new Date()) : null,
          paymentBy: installment.status === 'PAID' ? installment.paymentBy || 'CASH' : null,
          transactionNo:
            installment.status === 'PAID' ? installment.transactionNo.trim() || null : null,
          status: installment.status,
        })),
      };
      const response = await lastValueFrom(
        this.courseService.updateOfflineCourseInstallments(payload).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Installments updated successfully.');
        await this.loadStudents(this.meta.currentPage);
        this.refreshSelectedStudent(response.data?.paymentLogId || payload.paymentLogId);
      } else {
        await this.alertHelper.error(response.message || 'Unable to update installments.');
      }
    } catch (error: any) {
      const apiErrors = this.extractApiErrors(error?.error?.errors);
      this.installmentErrors = apiErrors;
      await this.alertHelper.error(
        this.firstApiMessage(apiErrors) || error?.error?.message || 'Unable to update installments.',
        'Installments',
      );
    } finally {
      this.savingInstallments = false;
      this.cdr.markForCheck();
    }
  }

  openInstallmentPayment(installment: OfflineCourseStudentInstallment): void {
    if (!this.selectedStudent || !this.canPayInstallment(installment) || !installment.id) {
      return;
    }

    this.selectedInstallment = installment;
    this.payForm.reset({
      paymentDate: this.toIsoDate(new Date()),
      paymentType: 'CASH',
      transactionNo: '',
      amountPaid: this.getInstallmentBalanceAmount(installment),
      remarks: '',
    });
    this.payForm.markAsPristine();
    this.payForm.markAsUntouched();
    this.payModalOpen = true;
  }

  closeInstallmentPayment(force = false): void {
    if (this.paymentSubmitting && !force) {
      return;
    }

    this.payModalOpen = false;
    this.selectedInstallment = null;
    this.payForm.reset({
      paymentDate: this.toIsoDate(new Date()),
      paymentType: 'CASH',
      transactionNo: '',
      amountPaid: 0,
      remarks: '',
    });
  }

  onPayPaymentTypeChange(): void {
    if (this.payForm.get('paymentType')?.value === 'CASH') {
      this.payForm.patchValue({ transactionNo: '' });
    }

    this.payForm.updateValueAndValidity();
  }

  async submitInstallmentPayment(): Promise<void> {
    if (!this.selectedStudent || !this.selectedInstallment?.id) {
      return;
    }

    this.payForm.updateValueAndValidity();

    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }

    const formValue = this.payForm.getRawValue();
    const confirmed = await this.alertHelper.confirm(
      `Collect ${this.formatMoney(formValue.amountPaid)} for ${this.ordinalInstallment(this.selectedInstallment.installmentNo)} installment?`,
      'Pay Installment',
      'Collect Payment',
    );

    if (!confirmed || !this.selectedStudent || !this.selectedInstallment?.id) {
      return;
    }

    const currentPaymentLogId = this.selectedStudent.paymentLogId;
    const payload: OfflineCourseInstallmentPayPayload = {
      enrollmentId: this.selectedStudent.enrollmentId,
      installmentId: this.selectedInstallment.id,
      paymentDate: formValue.paymentDate,
      paymentType: formValue.paymentType as OfflineInstallmentPaymentType,
      transactionNo:
        formValue.paymentType === 'CASH'
          ? null
          : `${formValue.transactionNo || ''}`.trim() || null,
      amountPaid: this.toMoney(formValue.amountPaid),
      remarks: `${formValue.remarks || ''}`.trim() || null,
    };

    this.paymentSubmitting = true;

    try {
      const response = await lastValueFrom(
        this.courseService.payOfflineCourseInstallment(payload).pipe(timeout(15000)),
      );

      if (response.status) {
        const courseCode = response.data?.courseCode ? ` Code: ${response.data.courseCode}` : '';
        await this.alertHelper.success(`${response.message || 'Installment payment updated successfully.'}${courseCode}`);
        this.closeInstallmentPayment(true);
        await this.loadStudents(this.meta.currentPage);

        if (currentPaymentLogId) {
          this.refreshSelectedStudent(currentPaymentLogId);
        }
      } else {
        await this.alertHelper.error(response.message || 'Unable to update installment payment.');
      }
    } catch (error: any) {
      const apiErrors = this.extractApiErrors(error?.error?.errors);
      await this.alertHelper.error(
        this.firstApiMessage(apiErrors) || error?.error?.message || 'Unable to update installment payment.',
        'Pay Installment',
      );
    } finally {
      this.paymentSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  keepCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  openCalendar(index: number, event: Event): void {
    event.stopPropagation();

    if (this.installmentDraft[index]?.status !== 'PENDING') {
      return;
    }

    this.openInstallmentCalendar = this.openInstallmentCalendar === index ? null : index;
    this.installmentCalendarViews[index] = this.getCalendarStartDate(index);
  }

  getInstallmentCalendarView(index: number): Date {
    if (!this.installmentCalendarViews[index]) {
      this.installmentCalendarViews[index] = this.getCalendarStartDate(index);
    }

    return this.installmentCalendarViews[index];
  }

  setInstallmentCalendarMonth(index: number, month: number): void {
    const view = this.getInstallmentCalendarView(index);
    this.installmentCalendarViews[index] = new Date(view.getFullYear(), month, 1);
  }

  setInstallmentCalendarYear(index: number, year: number): void {
    const view = this.getInstallmentCalendarView(index);
    this.installmentCalendarViews[index] = new Date(year, view.getMonth(), 1);
  }

  moveInstallmentCalendar(index: number, direction: -1 | 1, event: Event): void {
    event.stopPropagation();
    const view = this.getInstallmentCalendarView(index);
    this.installmentCalendarViews[index] = new Date(view.getFullYear(), view.getMonth() + direction, 1);
  }

  getInstallmentCalendarDays(index: number): InstallmentCalendarDay[] {
    const selectedIso = this.installmentDraft[index]?.expectedDate || '';
    const todayIso = this.toIsoDate(new Date());
    const view = this.getInstallmentCalendarView(index);
    const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, dayIndex) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayIndex);
      const iso = this.toIsoDate(date);

      return {
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === view.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: iso < todayIso,
      };
    });
  }

  selectInstallmentDate(index: number, day: InstallmentCalendarDay, event: Event): void {
    event.stopPropagation();

    if (day.isDisabled) {
      return;
    }

    const installment = this.installmentDraft[index];

    if (!installment) {
      return;
    }

    installment.expectedDate = day.iso;
    this.openInstallmentCalendar = null;
    this.clearInstallmentErrors([`installments.${index}.expectedDate`, 'installments']);
  }

  clearInstallmentDate(index: number, event: Event): void {
    event.stopPropagation();
    const installment = this.installmentDraft[index];

    if (!installment || installment.status !== 'PENDING') {
      return;
    }

    installment.expectedDate = '';
    this.clearInstallmentErrors([`installments.${index}.expectedDate`]);
  }

  trackByStudentId(_index: number, student: OfflineCourseStudentItem): number {
    return student.enrollmentId;
  }

  trackByInstallment(index: number, installment: InstallmentDraft | OfflineCourseStudentInstallment): number {
    return installment.id || installment.installmentNo || index;
  }

  formatMoney(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(this.toMoney(value));
  }

  formatDate(value: string | null | undefined): string {
    const date = this.parseIsoDate(`${value || ''}`.slice(0, 10));

    if (!date) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatDateRange(student: OfflineCourseStudentItem): string {
    if (!student.startDate) {
      return 'N/A';
    }

    if (!student.endDate || student.endDate === student.startDate) {
      return this.formatDate(student.startDate);
    }

    return `${this.formatDate(student.startDate)} - ${this.formatDate(student.endDate)}`;
  }

  getGenderLabel(value: number | null): string {
    if (value === 1) {
      return 'Male';
    }

    if (value === 2) {
      return 'Female';
    }

    return 'N/A';
  }

  getInitials(name: string | null | undefined): string {
    const words = `${name || ''}`.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return 'ST';
    }

    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }

  getNextInstallmentLabel(student: OfflineCourseStudentItem): string {
    return this.formatDate(student.nextUpcomingInstallmentDate || student.nextInstallmentDate);
  }

  getPaymentCompletionPercent(student: OfflineCourseStudentItem | null | undefined): number {
    const totalFee = this.toMoney(student?.totalFee);

    if (totalFee <= 0) {
      return 0;
    }

    return this.clampPercent((this.toMoney(student?.amountPaid) / totalFee) * 100);
  }

  getNextPendingInstallment(
    student: OfflineCourseStudentItem | null | undefined = this.selectedStudent,
  ): OfflineCourseStudentInstallment | null {
    const pendingInstallments = [...(student?.installments || [])]
      .filter((installment) => this.canPayInstallment(installment))
      .sort((first, second) => {
        const firstDate = first.expectedDate || '9999-12-31';
        const secondDate = second.expectedDate || '9999-12-31';

        if (firstDate !== secondDate) {
          return firstDate.localeCompare(secondDate);
        }

        return (first.installmentNo || 0) - (second.installmentNo || 0);
      });

    return pendingInstallments[0] || null;
  }

  isNextPendingInstallment(installment: OfflineCourseStudentInstallment): boolean {
    const nextInstallment = this.getNextPendingInstallment(this.selectedStudent);

    if (!nextInstallment) {
      return false;
    }

    if (nextInstallment.id && installment.id) {
      return nextInstallment.id === installment.id;
    }

    return nextInstallment.installmentNo === installment.installmentNo;
  }

  getInstallmentProgressPercent(installment: OfflineCourseStudentInstallment | null): number {
    const amount = this.getInstallmentAmount(installment);

    if (amount <= 0) {
      return this.getInstallmentStatus(installment) === 'PAID' ? 100 : 0;
    }

    return this.clampPercent((this.getInstallmentPaidAmount(installment) / amount) * 100);
  }

  getInstallmentStatusIcon(installment: OfflineCourseStudentInstallment | null): string {
    const status = this.getInstallmentStatus(installment);

    if (status === 'PAID') {
      return 'feather-check-circle';
    }

    if (status === 'PARTIALLY_PAID') {
      return 'feather-refresh-cw';
    }

    if (status === 'OVERDUE') {
      return 'feather-alert-circle';
    }

    return 'feather-clock';
  }

  isInstallmentPaid(installment: OfflineCourseStudentInstallment | null): boolean {
    return this.getInstallmentStatus(installment) === 'PAID';
  }

  getInstallmentError(key: string): string {
    return this.installmentErrors[key] || '';
  }

  getPayFieldError(field: string): string {
    const control = this.payForm.get(field);

    if (!control || (!control.touched && !control.dirty)) {
      return '';
    }

    if (field === 'transactionNo' && this.payForm.hasError('transactionNoRequired')) {
      return 'Transaction no is required for non-cash payments.';
    }

    if (field === 'amountPaid' && this.payForm.hasError('amountTooHigh')) {
      return 'Amount paid cannot be greater than the pending amount.';
    }

    if (control.hasError('required')) {
      return 'This field is required.';
    }

    if (control.hasError('min')) {
      return 'Amount must be greater than 0.';
    }

    return '';
  }

  getInstallmentStatus(installment: OfflineCourseStudentInstallment | null): OfflineCourseEnrollmentInstallmentStatus {
    const status = `${installment?.paymentStatus || installment?.status || 'PENDING'}`.toUpperCase();
    const balance = this.getInstallmentBalanceAmount(installment);

    if (status === 'PAID' || balance <= 0) {
      return 'PAID';
    }

    if (status === 'PARTIALLY_PAID' || this.getInstallmentPaidAmount(installment) > 0) {
      return 'PARTIALLY_PAID';
    }

    if (installment?.isOverdue || (installment?.expectedDate && installment.expectedDate < this.toIsoDate(new Date()))) {
      return 'OVERDUE';
    }

    return 'PENDING';
  }

  getInstallmentStatusLabel(installment: OfflineCourseStudentInstallment | null): string {
    const status = this.getInstallmentStatus(installment);

    if (status === 'PAID') {
      return 'Paid';
    }

    if (status === 'PARTIALLY_PAID') {
      return 'Partially Paid';
    }

    if (status === 'OVERDUE') {
      return 'Overdue';
    }

    return 'Pending';
  }

  getInstallmentStatusClass(installment: OfflineCourseStudentInstallment | null): string {
    return `student-badge--${this.getInstallmentStatus(installment).toLowerCase().replace('_', '-')}`;
  }

  getInstallmentAmount(installment: OfflineCourseStudentInstallment | null): number {
    return this.toMoney(installment?.installmentAmount ?? installment?.amount ?? 0);
  }

  getInstallmentPaidAmount(installment: OfflineCourseStudentInstallment | null): number {
    if (!installment) {
      return 0;
    }

    if (installment.paidAmount !== undefined && installment.paidAmount !== null) {
      return this.toMoney(installment.paidAmount);
    }

    return installment.status === 'PAID' ? this.getInstallmentAmount(installment) : 0;
  }

  getInstallmentBalanceAmount(installment: OfflineCourseStudentInstallment | null): number {
    if (!installment) {
      return 0;
    }

    if (installment.balanceAmount !== undefined && installment.balanceAmount !== null) {
      return this.toMoney(installment.balanceAmount);
    }

    return this.toMoney(Math.max(this.getInstallmentAmount(installment) - this.getInstallmentPaidAmount(installment), 0));
  }

  getInstallmentPaymentDate(installment: OfflineCourseStudentInstallment): string | null {
    return installment.paymentDate || installment.paidDate || null;
  }

  getPaymentTypeLabel(value: string | null | undefined): string {
    const normalizedValue = this.normalizePaymentType(value);
    const option = this.paymentByOptions.find((item) => item.value === normalizedValue);

    return option?.label || value || 'N/A';
  }

  canPayInstallment(installment: OfflineCourseStudentInstallment): boolean {
    return Boolean(installment.id) && this.getInstallmentStatus(installment) !== 'PAID' && this.getInstallmentBalanceAmount(installment) > 0;
  }

  ordinalInstallment(value: number | null | undefined): string {
    const numberValue = Number(value) || 0;
    const suffix =
      numberValue % 100 >= 11 && numberValue % 100 <= 13
        ? 'th'
        : numberValue % 10 === 1
          ? 'st'
          : numberValue % 10 === 2
            ? 'nd'
            : numberValue % 10 === 3
              ? 'rd'
              : 'th';

    return `${numberValue}${suffix}`;
  }

  getInstallmentInvoiceUrl(installment: OfflineCourseStudentInstallment): string | null {
    const directUrl = `${installment.invoiceDownloadUrl || ''}`.trim();
    const apiUrl = this.courseService.API_URL.replace(/\/$/, '');

    if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
      return directUrl;
    }

    if (directUrl.startsWith('/api/')) {
      return `${apiUrl.replace(/\/api$/, '')}${directUrl}`;
    }

    if (installment.invoiceOrderId) {
      return `${apiUrl}/invoice/${installment.invoiceOrderId}/download`;
    }

    return null;
  }

  getPaginationLabel(): string {
    const from = this.meta.from ?? 0;
    const to = this.meta.to ?? 0;

    return `Showing ${from}-${to} of ${this.meta.total} enrolled students`;
  }

  private buildListPayload(page: number): Record<string, string | number | null> {
    const courseCode = this.courseCode.trim();

    return {
      page,
      perPage: this.meta.perPage,
      search: this.search.trim(),
      courseCode: courseCode || null,
      paymentStatus: this.paymentStatus,
      installmentStatus: this.installmentStatus,
      sortBy: this.sortBy,
    };
  }

  private resetResults(): void {
    this.students = [];
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

  private createDefaultSummary(): OfflineCourseStudentSummary {
    return {
      totalEnrollments: 0,
      totalStudents: 0,
      totalCourses: 0,
      paidStudents: 0,
      partialStudents: 0,
      pendingInstallments: 0,
      overdueInstallments: 0,
      totalFee: 0,
      totalPaid: 0,
      totalBalance: 0,
      nextInstallmentDate: null,
      nextUpcomingInstallmentDate: null,
    };
  }

  private toInstallmentDraft(
    installments: OfflineCourseStudentInstallment[],
    student?: OfflineCourseStudentItem,
  ): InstallmentDraft[] {
    return (installments || []).map((installment) => ({
      id: installment.id,
      installmentNo: installment.installmentNo,
      amount: this.toMoney(installment.amount),
      expectedDate: installment.expectedDate || '',
      paidDate: installment.paidDate || '',
      paymentBy:
        installment.status === 'PAID'
          ? this.normalizePaymentType(installment.paymentType || installment.paymentBy || student?.paymentBy)
          : '',
      transactionNo:
        installment.status === 'PAID'
          ? installment.transactionNo || student?.transactionNo || ''
          : '',
      status: installment.status,
      isOverdue: installment.isOverdue,
    }));
  }

  private validateInstallments(): boolean {
    const errors: Record<string, string> = {};

    if (!this.canSaveInstallments) {
      errors['installments'] = 'No editable installment schedule is linked with this payment.';
    }

    this.installmentDraft.forEach((installment, index) => {
      if (!Number.isFinite(Number(installment.amount)) || this.toMoney(installment.amount) < 0) {
        errors[`installments.${index}.amount`] = 'Amount must be 0 or more.';
      }

      if (installment.status === 'PENDING' && !installment.expectedDate) {
        errors[`installments.${index}.expectedDate`] = 'Expected date is required.';
      }

      if (installment.status === 'PAID') {
        if (!installment.paymentBy) {
          errors[`installments.${index}.paymentBy`] = 'Payment by is required.';
        }

        if (installment.paymentBy !== 'CASH' && !installment.transactionNo.trim()) {
          errors[`installments.${index}.transactionNo`] = 'Transaction no is required.';
        }
      }
    });

    if (this.selectedStudent && Math.abs(this.draftTotal - this.selectedStudent.totalFee) > 0.01) {
      errors['installments'] = 'Installment amounts must equal the total fee.';
    }

    this.installmentErrors = errors;

    return Object.keys(errors).length === 0;
  }

  private refreshSelectedStudent(paymentLogId: number): void {
    const refreshedStudent = this.students.find((student) => student.paymentLogId === paymentLogId);

    if (!refreshedStudent) {
      this.closePaymentDetails(true);
      return;
    }

    this.selectedStudent = refreshedStudent;
    this.installmentDraft = this.toInstallmentDraft(refreshedStudent.installments, refreshedStudent);
  }

  private renumberInstallments(): void {
    this.installmentDraft = this.installmentDraft.map((installment, index) => ({
      ...installment,
      installmentNo: index + 1,
    }));
  }

  private getCalendarStartDate(index: number): Date {
    const selectedDate = this.parseIsoDate(this.installmentDraft[index]?.expectedDate || '');
    const today = new Date();
    const date = selectedDate || today;

    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private buildInstallmentCalendarYearOptions(): number[] {
    return Array.from({ length: 13 }, (_, index) => this.currentYear - 2 + index);
  }

  private toMoney(value: number | string | null | undefined): number {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.round(amount * 100) / 100;
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(Math.max(Math.round(value), 0), 100);
  }

  private normalizePaymentType(value: string | null | undefined): OfflineInstallmentPaymentType | '' {
    const normalizedValue = `${value || ''}`.trim().toUpperCase();

    if (normalizedValue === 'NETBANKING' || normalizedValue === 'NET_BANKING') {
      return 'BANK_TRANSFER';
    }

    return this.paymentByOptions.some((option) => option.value === normalizedValue)
      ? (normalizedValue as OfflineInstallmentPaymentType)
      : '';
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private installmentTransactionValidator(control: AbstractControl): ValidationErrors | null {
    const paymentType = control.get('paymentType')?.value;
    const transactionNo = `${control.get('transactionNo')?.value || ''}`.trim();

    return paymentType && paymentType !== 'CASH' && !transactionNo
      ? { transactionNoRequired: true }
      : null;
  }

  private installmentAmountValidator(control: AbstractControl): ValidationErrors | null {
    const amountPaid = this.toMoney(control.get('amountPaid')?.value);
    const pendingAmount = this.selectedInstallmentPendingAmount;

    if (!this.selectedInstallment || amountPaid <= 0) {
      return null;
    }

    return amountPaid - pendingAmount > 0.01 ? { amountTooHigh: true } : null;
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

  private clearInstallmentErrors(fields: string[]): void {
    fields.forEach((field) => {
      delete this.installmentErrors[field];
    });
  }
}
