import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { lastValueFrom, Observable, Subscription, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { PaymentService } from '../../services/payment';
import {
  WorkshopItem,
  WorkshopListResponse,
  WorkshopService,
} from '../../../workshop-seminar/services/workshop';
import {
  SeminarItem,
  SeminarListResponse,
  SeminarService,
} from '../../../workshop-seminar/services/seminar';

declare const Razorpay: any;

type ProgramType = 'workshop' | 'seminar';
type ProgramItem = (WorkshopItem | SeminarItem) & { isEnrolled?: boolean };
type ProgramListResponse = WorkshopListResponse | SeminarListResponse;
type TimelineFilter = 'all' | 'upcoming' | 'ongoing';
type ProgramSortOption = 'dateAsc' | 'dateDesc' | 'latest';
type ProgramViewMode = 'list' | 'grid';

interface ProgramPaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

@Component({
  selector: 'app-program-browse',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './program-browse.html',
  styleUrl: './program-browse.scss',
})
export class ProgramBrowseComponent implements OnInit, OnDestroy {
  readonly placeholderImage = 'assets/images/event/grid-type-02.jpg';
  readonly timelineOptions: Array<{ value: TimelineFilter; label: string }> = [
    { value: 'all', label: 'All Current' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'upcoming', label: 'Upcoming' },
  ];
  readonly sortOptions: Array<{ value: ProgramSortOption; label: string }> = [
    { value: 'dateAsc', label: 'Nearest Date' },
    { value: 'dateDesc', label: 'Latest Date' },
    { value: 'latest', label: 'Recently Added' },
  ];
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly viewModeOptions: Array<{ value: ProgramViewMode; label: string; icon: string }> = [
    { value: 'list', label: 'List', icon: 'feather-list' },
    { value: 'grid', label: 'Grid', icon: 'feather-grid' },
  ];

  private routeDataSubscription?: Subscription;
  private requestSerial = 0;
  private readonly minimumSearchLength = 3;
  private enrolledProgramIds = new Set<number>();

  programType: ProgramType = 'workshop';
  programs: ProgramItem[] = [];
  loading = false;
  showFilters = false;
  search = '';
  city = '';
  timeline: TimelineFilter = 'all';
  sortBy: ProgramSortOption = 'dateAsc';
  pageInput = 1;
  message = '';
  viewMode: ProgramViewMode = 'list';
  processingProgramId: number | null = null;
  meta: ProgramPaginationMeta = this.createDefaultMeta();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly workshopService: WorkshopService,
    private readonly seminarService: SeminarService,
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.routeDataSubscription = this.route.data.subscribe((data) => {
      const nextType = data['programType'] === 'seminar' ? 'seminar' : 'workshop';

      if (this.programType !== nextType) {
        this.resetFilters();
      }

      this.programType = nextType;
      void this.loadPrograms(1);
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  ngOnDestroy(): void {
    this.routeDataSubscription?.unsubscribe();
  }

  async loadPrograms(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.message = '';
    this.cdr.markForCheck();

    const payload = {
      page,
      perPage: this.meta.perPage,
      search: this.normalizedSearchTerm,
      city: this.city.trim(),
      scheduleStatus: this.timeline,
      sortBy: this.sortBy,
    };

    try {
      const [response] = await Promise.all([
        lastValueFrom(this.fetchPrograms(payload).pipe(timeout(15000))),
        this.loadEnrolledProgramIds(requestId),
      ]);

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.programs = this.normalizePrograms(response.data ?? []);
        this.meta = this.normalizeMeta(response.meta);
        this.pageInput = this.meta.currentPage;

        if (this.programs.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadPrograms(this.meta.currentPage - 1);
        }
      } else {
        this.resetResults();
        this.message = response.message || `No ${this.pluralLabelLower} found.`;
      }
    } catch (error: any) {
      if (requestId !== this.requestSerial) {
        return;
      }

      console.error(error);
      this.resetResults();
      this.message = error?.error?.message || `Unable to load ${this.pluralLabelLower}.`;
    } finally {
      if (requestId === this.requestSerial) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  onSearch(): void {
    const rawSearchTerm = this.search.trim();

    if (rawSearchTerm.length > 0 && rawSearchTerm.length < this.minimumSearchLength) {
      this.message = `Search needs at least ${this.minimumSearchLength} characters.`;
      return;
    }

    void this.loadPrograms(1);
  }

  onFilterChange(): void {
    void this.loadPrograms(1);
  }

  clearFilters(): void {
    this.resetFilters();
    void this.loadPrograms(1);
  }

  selectTimeline(value: TimelineFilter): void {
    if (this.timeline === value) {
      return;
    }

    this.timeline = value;
    void this.loadPrograms(1);
  }

  selectViewMode(value: ProgramViewMode): void {
    this.viewMode = value;
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage > 1) {
      void this.loadPrograms(this.meta.currentPage - 1);
    }
  }

  goToNextPage(): void {
    if (this.meta.currentPage < this.meta.lastPage) {
      void this.loadPrograms(this.meta.currentPage + 1);
    }
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page !== this.meta.currentPage) {
      void this.loadPrograms(page);
    }
  }

  async buyProgram(program: ProgramItem): Promise<void> {
    if (this.processingProgramId !== null) {
      return;
    }

    if (this.isProgramEnrolled(program)) {
      await this.alertHelper.info(
        `You are already enrolled in this ${this.singularLabelLower}.`,
        'Already Enrolled',
      );
      return;
    }

    if (!this.isLoggedIn()) {
      localStorage.setItem(
        'program_checkout_intent',
        JSON.stringify({ entityType: this.programType, entityId: program.id }),
      );
      await this.alertHelper.info(`Please login to buy this ${this.singularLabelLower}.`, 'Login Required');
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Buy ${program.title} for ${this.formatPrice(program.price)}?`,
      `Buy ${this.singularLabel}`,
      'Proceed',
      'Cancel',
    );

    if (!confirmed) {
      return;
    }

    this.processingProgramId = program.id;
    this.cdr.markForCheck();

    try {
      const response: any = await lastValueFrom(
        this.paymentService.programCheckoutInit({
          entityType: this.programType,
          entityId: program.id,
        }),
      );

      if (!response.success) {
        await this.alertHelper.error(response.message || 'Checkout failed', 'Checkout Failed');
        return;
      }

      localStorage.setItem(
        'programCheckoutData',
        JSON.stringify({
          orderId: response.orderId,
          totalAmount: response.totalAmount,
          program: response.program,
        }),
      );

      await this.openRazorpay(response);
    } catch (error: any) {
      console.error(error);
      await this.alertHelper.error(
        error?.error?.message || `Unable to initialize ${this.singularLabelLower} checkout`,
        'Checkout Failed',
      );
    } finally {
      this.processingProgramId = null;
      this.cdr.markForCheck();
    }
  }

  trackByProgramId(_: number, program: ProgramItem): number {
    return program.id;
  }

  programImage(program: ProgramItem): string {
    return program.bannerImageUrl || this.placeholderImage;
  }

  onProgramImageError(program: ProgramItem): void {
    program.bannerImageUrl = null;
  }

  getDateRange(program: ProgramItem): string {
    const startDate = this.formatDate(program.startDate || program.eventDate);
    const endDate = this.formatDate(program.endDate || '');

    if (!startDate && !endDate) {
      return 'Date TBA';
    }

    if (!endDate || startDate === endDate) {
      return startDate;
    }

    return `${startDate} - ${endDate}`;
  }

  getTimeRange(program: ProgramItem): string {
    if (!program.startTime && !program.endTime) {
      return 'Time TBA';
    }

    return program.endTime ? `${program.startTime} - ${program.endTime}` : program.startTime || 'Time TBA';
  }

  getScheduleLabel(program: ProgramItem): string {
    return program.scheduleStatus === 'ongoing' ? 'Ongoing' : 'Upcoming';
  }

  getTakeaways(program: ProgramItem, limit = 3): string[] {
    return (Array.isArray(program.takeaways) ? program.takeaways : []).slice(0, limit);
  }

  isProgramEnrolled(program: ProgramItem): boolean {
    return Boolean(program.isEnrolled || this.enrolledProgramIds.has(Number(program.id)));
  }

  getPaginationLabel(): string {
    if (!this.meta.total) {
      return `No ${this.pluralLabelLower} found`;
    }

    return `Showing ${this.meta.from || 0}-${this.meta.to || 0} of ${this.meta.total} ${this.pluralLabelLower}`;
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

  get singularLabel(): string {
    return this.programType === 'seminar' ? 'Seminar' : 'Workshop';
  }

  get pluralLabel(): string {
    return this.programType === 'seminar' ? 'Seminars' : 'Workshops';
  }

  get singularLabelLower(): string {
    return this.singularLabel.toLowerCase();
  }

  get pluralLabelLower(): string {
    return this.pluralLabel.toLowerCase();
  }

  get pageEyebrow(): string {
    return this.programType === 'seminar' ? 'Live Seminar Catalog' : 'Live Workshop Catalog';
  }

  get pageDescription(): string {
    return this.programType === 'seminar'
      ? 'Browse active ICTEL seminars, reserve your seat, and receive an invoice after payment.'
      : 'Browse active ICTEL workshops, reserve your seat, and receive an invoice after payment.';
  }

  get alternateRoute(): string {
    return this.programType === 'seminar'
      ? '/application/courses/manageCourses/browseWorkshop'
      : '/application/courses/manageCourses/browseSeminars';
  }

  get alternateLabel(): string {
    return this.programType === 'seminar' ? 'Browse Workshops' : 'Browse Seminars';
  }

  private fetchPrograms(payload: Record<string, unknown>): Observable<ProgramListResponse> {
    return this.programType === 'seminar'
      ? this.seminarService.getPublicSeminars(payload)
      : this.workshopService.getPublicWorkshops(payload);
  }

  private async loadEnrolledProgramIds(requestId: number): Promise<void> {
    if (!this.isLoggedIn()) {
      this.enrolledProgramIds = new Set<number>();
      return;
    }

    try {
      const response = await lastValueFrom(
        this.paymentService.getMyPrograms(this.programType).pipe(timeout(15000)),
      );

      if (requestId !== this.requestSerial) {
        return;
      }

      this.enrolledProgramIds = new Set(
        (response.data ?? [])
          .filter((program) => program.type === this.programType)
          .map((program) => Number(program.id))
          .filter((id) => Number.isFinite(id)),
      );
    } catch (error) {
      if (requestId !== this.requestSerial) {
        return;
      }

      console.error(error);
      this.enrolledProgramIds = new Set<number>();
    }
  }

  private normalizePrograms(programs: Array<WorkshopItem | SeminarItem>): ProgramItem[] {
    return programs.map((program) => ({
      ...program,
      price: Number.isFinite(Number(program.price)) ? Number(program.price) : 0,
      takeaways: Array.isArray(program.takeaways) ? program.takeaways : [],
      scheduleStatus: program.scheduleStatus === 'ongoing' ? 'ongoing' : 'upcoming',
      isEnrolled: this.enrolledProgramIds.has(Number(program.id)),
    }));
  }

  private async openRazorpay(response: any): Promise<void> {
    if (typeof Razorpay === 'undefined') {
      await this.alertHelper.error('Payment gateway is not loaded. Please refresh and try again.', 'Payment');
      return;
    }

    const user = this.getStoredUser();
    let paymentCompleted = false;

    const options = {
      key: response.razorpayKey,
      amount: response.amountInPaise,
      currency: response.currency || 'INR',
      name: 'ICETL',
      description: `${response.program?.entityLabel || this.singularLabel} purchase`,
      order_id: response.razorpayOrderId,
      handler: async (paymentResponse: any) => {
        paymentCompleted = true;

        try {
          const verifyResponse: any = await lastValueFrom(
            this.paymentService.verifyPayment({
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              orderId: response.orderId,
            }),
          );

          if (verifyResponse.success) {
            localStorage.removeItem('programCheckoutData');
            localStorage.removeItem('program_checkout_intent');
            await this.alertHelper.success('Payment successful. Invoice generated.', 'Payment Success');
            void this.router.navigate(['/application/paymentLog']);
          } else {
            await this.alertHelper.error(
              verifyResponse.message || 'Payment verification failed',
              'Verification Failed',
            );
          }
        } catch (error: any) {
          console.error(error);
          await this.alertHelper.error(
            error?.error?.message || 'Payment verification failed',
            'Payment Error',
          );
        }
      },
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: user.phone || '',
      },
      notes: {
        orderId: response.orderId,
        entityType: response.program?.entityType || this.programType,
        entityId: response.program?.id || '',
      },
      theme: {
        color: '#2563eb',
      },
      modal: {
        ondismiss: async () => {
          if (paymentCompleted) {
            return;
          }

          paymentCompleted = true;
          await this.recordPaymentFailure(
            response.orderId,
            response.razorpayOrderId,
            null,
            'cancelled',
            'Payment window closed before completion',
            false,
          );
        },
      },
    };

    const razorpay = new Razorpay(options);

    razorpay.on('payment.failed', async (failureResponse: any) => {
      paymentCompleted = true;
      const error = failureResponse?.error ?? {};
      const reason = error.description || error.reason || error.code || 'Payment failed';

      await this.recordPaymentFailure(
        response.orderId,
        error.metadata?.order_id || response.razorpayOrderId,
        error.metadata?.payment_id || null,
        'failed',
        reason,
        true,
      );
    });

    razorpay.open();
  }

  private async recordPaymentFailure(
    orderId: number,
    razorpayOrderId: string | null,
    razorpayPaymentId: string | null,
    status: 'failed' | 'cancelled',
    reason: string,
    showMessage: boolean,
  ): Promise<void> {
    try {
      await lastValueFrom(
        this.paymentService.markPaymentFailure({
          orderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          status,
          reason,
        }),
      );

      localStorage.removeItem('programCheckoutData');

      if (showMessage) {
        await this.alertHelper.error(reason, 'Payment Failed');
      }
    } catch (error: any) {
      console.error(error);

      if (showMessage) {
        await this.alertHelper.error(
          error?.error?.message || 'Payment failed, but the failure could not be recorded.',
          'Payment Failed',
        );
      }
    }
  }

  private isLoggedIn(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  private getStoredUser(): { name?: string; email?: string; phone?: string } {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || '{}') ?? {};
    } catch {
      return {};
    }
  }

  private resetFilters(): void {
    this.search = '';
    this.city = '';
    this.timeline = 'all';
    this.sortBy = 'dateAsc';
    this.meta.perPage = 10;
    this.message = '';
  }

  private resetResults(): void {
    this.programs = [];
    this.meta = this.createDefaultMeta();
    this.pageInput = 1;
  }

  private normalizeMeta(
    meta?: WorkshopListResponse['meta'] | SeminarListResponse['meta'],
  ): ProgramPaginationMeta {
    const fallback = this.createDefaultMeta();

    if (!meta) {
      return fallback;
    }

    const perPage = meta.perPage === 'all' ? 'all' : Number(meta.perPage);
    const normalizedPerPage =
      perPage === 'all' || (typeof perPage === 'number' && Number.isFinite(perPage) && perPage > 0)
        ? perPage
        : fallback.perPage;

    return {
      currentPage: Number(meta.currentPage) || fallback.currentPage,
      perPage: normalizedPerPage,
      total: Number(meta.total) || 0,
      lastPage: Number(meta.lastPage) || fallback.lastPage,
      from: meta.from ?? null,
      to: meta.to ?? null,
    };
  }

  private createDefaultMeta(): ProgramPaginationMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private get normalizedSearchTerm(): string {
    const searchTerm = this.search.trim();

    return searchTerm.length >= this.minimumSearchLength ? searchTerm : '';
  }

  private formatDate(value: string): string {
    if (!value) {
      return '';
    }

    const normalizedDate = value.includes('T') ? value.slice(0, 10) : value.split(' ')[0];
    const date = new Date(`${normalizedDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}
