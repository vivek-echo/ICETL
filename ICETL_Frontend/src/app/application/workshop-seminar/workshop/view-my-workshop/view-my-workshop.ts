import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import {
  WorkshopItem,
  WorkshopPaginationMeta,
  WorkshopScheduleStatus,
  WorkshopScheduleFilter,
  WorkshopService,
  WorkshopSortOption,
  WorkshopSummary,
} from '../../services/workshop';
import { AddWorkshop } from '../add-workshop/add-workshop';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';

@Component({
  selector: 'app-view-my-workshop',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AddWorkshop,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './view-my-workshop.html',
  styleUrl: './view-my-workshop.scss',
})
export class ViewMyWorkshop implements OnInit {
  readonly addRoute = '/application/workshopSeminar/workshop/add';
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4];
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
  editingWorkshop: WorkshopItem | null = null;
  meta: WorkshopPaginationMeta = this.createDefaultMeta();
  summary: WorkshopSummary = this.createDefaultSummary();

  private requestSerial = 0;

  constructor(
    private readonly workshopService: WorkshopService,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
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
        this.workshopService.getMyWorkshops(this.buildListPayload(page)).pipe(timeout(15000)),
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
    } catch (error: any) {
      if (requestId !== this.requestSerial) {
        return;
      }

      this.resetResults();
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch workshops.',
        'Workshops',
      );
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

  goToAddWorkshop(): void {
    void this.router.navigate([this.addRoute]);
  }

  openEditWorkshop(workshop: WorkshopItem): void {
    if (this.isOngoing(workshop)) {
      return;
    }

    this.editingWorkshop = workshop;
    this.cdr.markForCheck();
  }

  closeEditWorkshop(): void {
    this.editingWorkshop = null;
    this.cdr.markForCheck();
  }

  async onWorkshopSaved(): Promise<void> {
    this.closeEditWorkshop();
    await this.loadWorkshops(this.meta.currentPage);
  }

  async deleteWorkshop(workshop: WorkshopItem): Promise<void> {
    if (this.isOngoing(workshop)) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Do you want to delete "${workshop.title}"?`,
      'Delete Workshop',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.workshopService.deleteWorkshop({ id: workshop.id }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadWorkshops(this.meta.currentPage);
        await this.alertHelper.success(response.message || 'Workshop deleted successfully.');
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to delete workshop.',
        'Delete Workshop',
      );
    }
  }

  async toggleStatus(workshop: WorkshopItem): Promise<void> {
    if (this.isOngoing(workshop)) {
      return;
    }

    const nextStatus = this.isActive(workshop) ? 0 : 1;
    const confirmed = await this.alertHelper.confirm(
      `Do you want to mark this workshop as ${nextStatus === 1 ? 'active' : 'inactive'}?`,
      'Update Status',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.workshopService
          .updateWorkshopStatus({ id: workshop.id, status: nextStatus })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadWorkshops(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to update workshop status.',
        'Update Status',
      );
    }
  }

  trackByProgramId(_: number, workshop: WorkshopItem): number {
    return workshop.id;
  }

  isActive(workshop: WorkshopItem): boolean {
    return Number(workshop.status) === 1;
  }

  isOngoing(workshop: WorkshopItem): boolean {
    return workshop.scheduleStatus === 'ongoing';
  }

  getScheduleLabel(scheduleStatus: WorkshopScheduleStatus): string {
    if (scheduleStatus === 'ongoing') {
      return 'Ongoing';
    }

    return scheduleStatus === 'completed' ? 'Completed' : 'Upcoming';
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

  formatDate(value: string | null): string {
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
}
