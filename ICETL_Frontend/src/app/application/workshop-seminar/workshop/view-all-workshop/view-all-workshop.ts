import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import {
  WorkshopItem,
  WorkshopPaginationMeta,
  WorkshopScheduleFilter,
  WorkshopService,
  WorkshopSortOption,
  WorkshopSummary,
} from '../../services/workshop';

@Component({
  selector: 'app-view-all-workshop',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-all-workshop.html',
  styleUrl: './view-all-workshop.scss',
})
export class ViewAllWorkshop implements OnInit {
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
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
  ];

  workshops: WorkshopItem[] = [];
  loading = false;
  search = '';
  city = '';
  status = '';
  scheduleStatus: WorkshopScheduleFilter = '';
  sortBy: WorkshopSortOption = 'newest';
  pageInput = 1;
  meta: WorkshopPaginationMeta = this.createDefaultMeta();
  summary: WorkshopSummary = this.createDefaultSummary();

  private requestSerial = 0;

  constructor(
    private readonly workshopService: WorkshopService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadWorkshops();
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
        scheduleStatus: workshop.scheduleStatus === 'completed' ? 'completed' : 'upcoming',
        takeaways: Array.isArray(workshop.takeaways) ? workshop.takeaways : [],
      };
    });
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
      completedWorkshops: 0,
    };
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
