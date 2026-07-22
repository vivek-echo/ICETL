import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import {
  WorkshopItem,
  WorkshopPaginationMeta,
  WorkshopScheduleFilter,
  WorkshopScheduleStatus,
  WorkshopService,
  WorkshopSortOption,
  WorkshopSummary,
} from '../../services/workshop';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';

type ProgramPaymentMode = 'CASH' | 'UPI' | 'NETBANKING';

interface WorkshopEnrollmentForm {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: number | null;
  paymentBy: ProgramPaymentMode;
  transactionNo: string;
  totalFee: number;
}

interface CalendarDay {
  date: Date;
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-view-all-workshop',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalWindowDirective, ModalWindowControlsComponent],
  templateUrl: './view-all-workshop.html',
  styleUrl: './view-all-workshop.scss',
})
export class ViewAllWorkshop implements OnInit {
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4];
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
  readonly sortOptions: Array<{ value: WorkshopSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Added' },
    { value: 'oldest', label: 'Oldest Added' },
    { value: 'dateAsc', label: 'Start Date Asc' },
    { value: 'dateDesc', label: 'Start Date Desc' },
  ];
  readonly scheduleFilters: Array<{ value: WorkshopScheduleFilter; label: string }> = [
    { value: '', label: 'All Timeline' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
  ];

  workshops: WorkshopItem[] = [];
  loading = false;
  showFilters = false;
  search = '';
  city = '';
  status = '';
  scheduleStatus: WorkshopScheduleFilter = '';
  sortBy: WorkshopSortOption = 'newest';
  pageInput = 1;
  meta: WorkshopPaginationMeta = this.createDefaultMeta();
  summary: WorkshopSummary = this.createDefaultSummary();
  selectedEnrollmentWorkshop: WorkshopItem | null = null;
  enrollmentForm: WorkshopEnrollmentForm = this.createEnrollmentForm();
  enrollmentErrors: Record<string, string> = {};
  enrollmentTouched: Record<string, boolean> = {};
  enrollmentSaving = false;
  isDobCalendarOpen = false;
  dobCalendarView = this.defaultDobCalendarView();

  private requestSerial = 0;

  constructor(
    private readonly workshopService: WorkshopService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadWorkshops();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  async loadWorkshops(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.workshopService.getAllWorkshops(this.buildListPayload(page)).pipe(timeout(15000)),
      );

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.workshops = this.normalizeWorkshops(response.data);
        this.meta = response.meta || this.createDefaultMeta();
        this.summary = response.summary || this.createDefaultSummary();
        this.pageInput = this.meta.currentPage;

        if (this.workshops.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadWorkshops(this.meta.currentPage - 1);
        }
      } else {
        this.resetResults();
      }
    } catch (error) {
      if (requestId !== this.requestSerial) {
        return;
      }

      console.error(error);
      this.resetResults();
    } finally {
      if (requestId === this.requestSerial) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  onSearch(): void {
    void this.loadWorkshops(1);
  }

  onFilterChange(): void {
    void this.loadWorkshops(1);
  }

  onPerPageChange(): void {
    void this.loadWorkshops(1);
  }

  clearFilters(): void {
    this.search = '';
    this.city = '';
    this.status = '';
    this.scheduleStatus = '';
    this.sortBy = 'newest';
    this.meta.perPage = 10;
    void this.loadWorkshops(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.loadWorkshops(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.loadWorkshops(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.loadWorkshops(page);
  }

  trackByWorkshopId(_: number, workshop: WorkshopItem): number {
    return workshop.id;
  }

  isActive(workshop: WorkshopItem): boolean {
    return Number(workshop.status) === 1;
  }

  canEnroll(workshop: WorkshopItem): boolean {
    return this.isActive(workshop) && workshop.scheduleStatus !== 'completed';
  }

  openEnrollment(workshop: WorkshopItem): void {
    this.selectedEnrollmentWorkshop = workshop;
    this.enrollmentForm = this.createEnrollmentForm(workshop);
    this.enrollmentErrors = {};
    this.enrollmentTouched = {};
    this.enrollmentSaving = false;
    this.isDobCalendarOpen = false;
    this.dobCalendarView = this.defaultDobCalendarView();
    this.cdr.markForCheck();
  }

  closeEnrollment(): void {
    if (this.enrollmentSaving) {
      return;
    }

    this.selectedEnrollmentWorkshop = null;
    this.enrollmentErrors = {};
    this.enrollmentTouched = {};
    this.isDobCalendarOpen = false;
  }

  onEnrollmentPaymentModeChange(): void {
    this.markEnrollmentFieldTouched('paymentBy');

    if (this.enrollmentForm.paymentBy === 'CASH') {
      this.enrollmentForm.transactionNo = '';
      delete this.enrollmentErrors['transactionNo'];
    }
  }

  onEnrollmentFieldChange(field: keyof WorkshopEnrollmentForm): void {
    this.markEnrollmentFieldTouched(field);
  }

  sanitizeEnrollmentPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '').slice(0, 10);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.enrollmentForm.phone = sanitized;
    this.markEnrollmentFieldTouched('phone');
  }

  markEnrollmentFieldTouched(field: string): void {
    this.enrollmentTouched[field] = true;
    this.enrollmentErrors = this.validateEnrollmentForm();
  }

  shouldShowEnrollmentError(field: string): boolean {
    return Boolean(this.enrollmentTouched[field] && this.enrollmentErrors[field]);
  }

  toggleDobCalendar(event: Event): void {
    event.stopPropagation();
    this.isDobCalendarOpen = !this.isDobCalendarOpen;
    this.dobCalendarView = this.enrollmentForm.dob
      ? this.parseIsoDate(this.enrollmentForm.dob) || this.defaultDobCalendarView()
      : this.dobCalendarView;
  }

  keepDobCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  changeDobCalendarMonth(direction: number): void {
    this.dobCalendarView = new Date(
      this.dobCalendarView.getFullYear(),
      this.dobCalendarView.getMonth() + direction,
      1,
    );
  }

  setDobCalendarMonth(event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    this.dobCalendarView = new Date(this.dobCalendarView.getFullYear(), month, 1);
  }

  setDobCalendarYear(event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    this.dobCalendarView = new Date(year, this.dobCalendarView.getMonth(), 1);
  }

  getDobCalendarDays(): CalendarDay[] {
    const firstOfMonth = new Date(this.dobCalendarView.getFullYear(), this.dobCalendarView.getMonth(), 1);
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const iso = this.toIsoDate(date);

      return {
        date,
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === this.dobCalendarView.getMonth(),
        isSelected: iso === this.enrollmentForm.dob,
        isToday: iso === this.toIsoDate(new Date()),
        isDisabled: date > this.todayAtMidnight(),
      };
    });
  }

  selectDobDate(day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    this.enrollmentForm.dob = day.iso;
    this.markEnrollmentFieldTouched('dob');
    this.isDobCalendarOpen = false;
  }

  clearDobDate(event?: Event): void {
    event?.stopPropagation();
    this.enrollmentForm.dob = '';
    this.markEnrollmentFieldTouched('dob');
    this.isDobCalendarOpen = false;
  }

  formatDobDisplay(): string {
    return this.enrollmentForm.dob ? this.formatDate(this.enrollmentForm.dob) : 'Select date of birth';
  }

  async submitEnrollment(): Promise<void> {
    if (!this.selectedEnrollmentWorkshop || this.enrollmentSaving) {
      return;
    }

    const errors = this.validateEnrollmentForm();
    this.enrollmentErrors = errors;
    this.enrollmentTouched = {
      name: true,
      email: true,
      phone: true,
      dob: true,
      gender: true,
      paymentBy: true,
      transactionNo: true,
    };

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.enrollmentSaving = true;

    try {
      const response = await lastValueFrom(
        this.workshopService.enrollStudent({
          workshopId: this.selectedEnrollmentWorkshop.id,
          name: this.enrollmentForm.name.trim(),
          email: this.enrollmentForm.email.trim().toLowerCase(),
          phone: this.enrollmentForm.phone.trim(),
          dob: this.enrollmentForm.dob,
          gender: Number(this.enrollmentForm.gender),
          paymentBy: this.enrollmentForm.paymentBy,
          transactionNo: this.enrollmentForm.transactionNo.trim() || null,
          totalFee: this.enrollmentForm.totalFee,
        }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Student enrolled successfully.');
        this.selectedEnrollmentWorkshop = null;
        this.enrollmentErrors = {};
        this.enrollmentTouched = {};
        return;
      }

      this.enrollmentErrors = {
        form: response.message || 'Unable to enroll student.',
      };
    } catch (error: unknown) {
      this.enrollmentErrors = this.extractEnrollmentErrors(error);
    } finally {
      this.enrollmentSaving = false;
      this.cdr.markForCheck();
    }
  }

  getEnrollmentError(field: string): string {
    return this.enrollmentErrors[field] || '';
  }

  getScheduleLabel(scheduleStatus: WorkshopScheduleStatus): string {
    if (scheduleStatus === 'ongoing') {
      return 'Ongoing';
    }

    return scheduleStatus === 'completed' ? 'Completed' : 'Upcoming';
  }

  getCreatorInitial(workshop: WorkshopItem): string {
    return workshop.createdByName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }

  formatPrice(value: number): string {
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

  formatDateRange(workshop: WorkshopItem): string {
    const startDate = workshop.startDate || workshop.eventDate || '';
    const endDate = workshop.endDate || '';

    if (!startDate) {
      return 'N/A';
    }

    if (!endDate || endDate === startDate) {
      return this.formatDate(startDate);
    }

    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }

  formatTimeRange(workshop: WorkshopItem): string {
    if (!workshop.startTime) {
      return 'N/A';
    }

    return workshop.endTime ? `${workshop.startTime} - ${workshop.endTime}` : workshop.startTime;
  }

  getProgramLocationLabel(workshop: WorkshopItem): string {
    return (
      workshop.locationLabel ||
      [workshop.branchName, workshop.districtName, workshop.stateName].filter(Boolean).join(', ') ||
      [workshop.venue, workshop.city].filter(Boolean).join(', ') ||
      'N/A'
    );
  }

  getProgramAddress(workshop: WorkshopItem): string {
    return `${workshop.branchAddress || ''}`.trim();
  }

  getTakeaways(workshop: WorkshopItem, limit = 3): string[] {
    return (Array.isArray(workshop.takeaways) ? workshop.takeaways : []).slice(0, limit);
  }

  getPaginationLabel(): string {
    const from = this.meta.from ?? 0;
    const to = this.meta.to ?? 0;

    return `Showing ${from}-${to} of ${this.meta.total} workshops`;
  }

  private buildListPayload(page: number): Record<string, unknown> {
    return {
      page,
      perPage: this.meta.perPage,
      search: this.search.trim(),
      city: this.city.trim(),
      status: this.status,
      scheduleStatus: this.scheduleStatus || 'all',
      sortBy: this.sortBy,
    };
  }

  private resetResults(): void {
    this.workshops = [];
    this.meta = this.createDefaultMeta();
    this.summary = this.createDefaultSummary();
    this.pageInput = 1;
  }

  private normalizeWorkshops(workshops: WorkshopItem[] | null | undefined): WorkshopItem[] {
    if (!Array.isArray(workshops)) {
      return [];
    }

    return workshops.map((workshop) => {
      const status = Number(workshop.status) === 0 ? 0 : 1;

      return {
        ...workshop,
        price: Number.isFinite(Number(workshop.price)) ? Number(workshop.price) : 0,
        status,
        statusLabel: workshop.statusLabel || (status === 1 ? 'Active' : 'Inactive'),
        scheduleStatus: this.normalizeScheduleStatus(workshop.scheduleStatus),
        takeaways: Array.isArray(workshop.takeaways) ? workshop.takeaways : [],
      };
    });
  }

  private normalizeScheduleStatus(scheduleStatus: WorkshopItem['scheduleStatus']): WorkshopScheduleStatus {
    return scheduleStatus === 'ongoing' || scheduleStatus === 'completed'
      ? scheduleStatus
      : 'upcoming';
  }

  private createDefaultMeta(): WorkshopPaginationMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createDefaultSummary(): WorkshopSummary {
    return {
      totalWorkshops: 0,
      activeWorkshops: 0,
      inactiveWorkshops: 0,
      upcomingWorkshops: 0,
      ongoingWorkshops: 0,
      completedWorkshops: 0,
    };
  }

  private createEnrollmentForm(workshop?: WorkshopItem): WorkshopEnrollmentForm {
    return {
      name: '',
      email: '',
      phone: '',
      dob: '',
      gender: null,
      paymentBy: 'CASH',
      transactionNo: '',
      totalFee: this.toMoney(workshop?.price ?? 0),
    };
  }

  private validateEnrollmentForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (this.enrollmentForm.name.trim().length < 2) {
      errors['name'] = 'Student name is required.';
    }

    if (!emailPattern.test(this.enrollmentForm.email.trim())) {
      errors['email'] = 'Valid email is required.';
    }

    if (!/^\d{10}$/.test(this.enrollmentForm.phone.trim())) {
      errors['phone'] = 'Enter a valid 10 digit mobile number.';
    }

    const dobDate = this.parseIsoDate(this.enrollmentForm.dob);

    if (!this.enrollmentForm.dob) {
      errors['dob'] = 'Date of birth is required.';
    } else if (!dobDate) {
      errors['dob'] = 'Select a valid date of birth.';
    } else if (dobDate > this.todayAtMidnight()) {
      errors['dob'] = 'Date of birth cannot be in the future.';
    }

    if (![1, 2].includes(Number(this.enrollmentForm.gender))) {
      errors['gender'] = 'Gender is required.';
    }

    if (this.enrollmentForm.paymentBy !== 'CASH' && !this.enrollmentForm.transactionNo.trim()) {
      errors['transactionNo'] = 'Transaction no is required for UPI and Netbanking payments.';
    }

    return errors;
  }

  private extractEnrollmentErrors(error: unknown): Record<string, string> {
    const response = (error as { error?: { message?: string; errors?: Record<string, string[]> } })?.error;
    const fieldErrors = response?.errors || {};
    const errors: Record<string, string> = {};

    Object.keys(fieldErrors).forEach((field) => {
      errors[field] = fieldErrors[field]?.[0] || 'Invalid value.';
    });

    if (Object.keys(errors).length === 0) {
      errors['form'] = response?.message || 'Unable to enroll student.';
    }

    return errors;
  }

  private toMoney(value: unknown): number {
    const amount = Number(value);

    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  }

  private buildDobCalendarYearOptions(): number[] {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 91 }, (_, index) => currentYear - index);
  }

  private defaultDobCalendarView(): Date {
    const today = new Date();

    return new Date(today.getFullYear() - 18, today.getMonth(), 1);
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private todayAtMidnight(): Date {
    const today = new Date();

    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private formatDate(value: string): string {
    const rawDate = `${value || ''}`.trim();

    if (!rawDate || rawDate === '0000-00-00') {
      return 'N/A';
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? new Date(`${rawDate}T00:00:00`)
      : new Date(rawDate);

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
