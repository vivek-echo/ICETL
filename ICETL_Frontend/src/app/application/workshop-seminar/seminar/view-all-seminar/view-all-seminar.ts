import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import {
  SeminarItem,
  SeminarPaginationMeta,
  SeminarScheduleFilter,
  SeminarScheduleStatus,
  SeminarService,
  SeminarSortOption,
  SeminarSummary,
} from '../../services/seminar';

@Component({
  selector: 'app-view-all-seminar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-all-seminar.html',
  styleUrl: './view-all-seminar.scss',
})
export class ViewAllSeminar implements OnInit {
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly skeletonRows = [1, 2, 3, 4];
  readonly sortOptions: Array<{ value: SeminarSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Added' },
    { value: 'oldest', label: 'Oldest Added' },
    { value: 'dateAsc', label: 'Event Date Asc' },
    { value: 'dateDesc', label: 'Event Date Desc' },
  ];
  readonly scheduleFilters: Array<{ value: SeminarScheduleFilter; label: string }> = [
    { value: '', label: 'All Timeline' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
  ];

  seminars: SeminarItem[] = [];
  loading = false;
  search = '';
  city = '';
  status = '';
  scheduleStatus: SeminarScheduleFilter = '';
  sortBy: SeminarSortOption = 'newest';
  pageInput = 1;
  meta: SeminarPaginationMeta = this.createDefaultMeta();
  summary: SeminarSummary = this.createDefaultSummary();

  private requestSerial = 0;

  constructor(
    private readonly seminarService: SeminarService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadSeminars();
  }

  async loadSeminars(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.seminarService.getAllSeminars(this.buildListPayload(page)).pipe(timeout(15000)),
      );

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.seminars = this.normalizeSeminars(response.data);
        this.meta = response.meta || this.createDefaultMeta();
        this.summary = response.summary || this.createDefaultSummary();
        this.pageInput = this.meta.currentPage;

        if (this.seminars.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadSeminars(this.meta.currentPage - 1);
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
    void this.loadSeminars(1);
  }

  onFilterChange(): void {
    void this.loadSeminars(1);
  }

  onPerPageChange(): void {
    void this.loadSeminars(1);
  }

  clearFilters(): void {
    this.search = '';
    this.city = '';
    this.status = '';
    this.scheduleStatus = '';
    this.sortBy = 'newest';
    this.meta.perPage = 10;
    void this.loadSeminars(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.loadSeminars(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.loadSeminars(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.loadSeminars(page);
  }

  trackBySeminarId(_: number, seminar: SeminarItem): number {
    return seminar.id;
  }

  isActive(seminar: SeminarItem): boolean {
    return Number(seminar.status) === 1;
  }

  getScheduleLabel(scheduleStatus: SeminarScheduleStatus): string {
    if (scheduleStatus === 'ongoing') {
      return 'Ongoing';
    }

    return scheduleStatus === 'completed' ? 'Completed' : 'Upcoming';
  }

  getCreatorInitial(seminar: SeminarItem): string {
    return seminar.createdByName?.trim()?.charAt(0)?.toUpperCase() || 'U';
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

  formatDate(value: string): string {
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

  formatTimeRange(seminar: SeminarItem): string {
    if (!seminar.startTime) {
      return 'N/A';
    }

    return seminar.endTime ? `${seminar.startTime} - ${seminar.endTime}` : seminar.startTime;
  }

  getTakeaways(seminar: SeminarItem, limit = 3): string[] {
    return (Array.isArray(seminar.takeaways) ? seminar.takeaways : []).slice(0, limit);
  }

  getPaginationLabel(): string {
    const from = this.meta.from ?? 0;
    const to = this.meta.to ?? 0;

    return `Showing ${from}-${to} of ${this.meta.total} seminars`;
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
    this.seminars = [];
    this.meta = this.createDefaultMeta();
    this.summary = this.createDefaultSummary();
    this.pageInput = 1;
  }

  private normalizeSeminars(seminars: SeminarItem[] | null | undefined): SeminarItem[] {
    if (!Array.isArray(seminars)) {
      return [];
    }

    return seminars.map((seminar) => {
      const status = Number(seminar.status) === 0 ? 0 : 1;

      return {
        ...seminar,
        price: Number.isFinite(Number(seminar.price)) ? Number(seminar.price) : 0,
        status,
        statusLabel: seminar.statusLabel || (status === 1 ? 'Active' : 'Inactive'),
        scheduleStatus: this.normalizeScheduleStatus(seminar.scheduleStatus),
        takeaways: Array.isArray(seminar.takeaways) ? seminar.takeaways : [],
      };
    });
  }

  private normalizeScheduleStatus(scheduleStatus: SeminarItem['scheduleStatus']): SeminarScheduleStatus {
    return scheduleStatus === 'ongoing' || scheduleStatus === 'completed'
      ? scheduleStatus
      : 'upcoming';
  }

  private createDefaultMeta(): SeminarPaginationMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createDefaultSummary(): SeminarSummary {
    return {
      totalSeminars: 0,
      activeSeminars: 0,
      inactiveSeminars: 0,
      upcomingSeminars: 0,
      ongoingSeminars: 0,
      completedSeminars: 0,
    };
  }
}
