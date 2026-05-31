import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import {
  SeminarItem,
  SeminarPaginationMeta,
  SeminarScheduleFilter,
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
  readonly sortOptions: Array<{ value: SeminarSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Added' },
    { value: 'oldest', label: 'Oldest Added' },
    { value: 'dateAsc', label: 'Event Date Asc' },
    { value: 'dateDesc', label: 'Event Date Desc' },
  ];
  readonly scheduleFilters: Array<{ value: SeminarScheduleFilter; label: string }> = [
    { value: '', label: 'All Timeline' },
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
  meta: SeminarPaginationMeta = {
    currentPage: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
    from: null,
    to: null,
  };
  summary: SeminarSummary = {
    totalSeminars: 0,
    activeSeminars: 0,
    inactiveSeminars: 0,
    upcomingSeminars: 0,
    completedSeminars: 0,
  };

  constructor(private readonly seminarService: SeminarService) {}

  ngOnInit(): void {
    void this.loadSeminars();
  }

  async loadSeminars(page = 1): Promise<void> {
    this.loading = true;

    try {
      const response = await lastValueFrom(
        this.seminarService
          .getAllSeminars({
            page,
            perPage: this.meta.perPage,
            search: this.search.trim(),
            city: this.city.trim(),
            status: this.status,
            scheduleStatus: this.scheduleStatus || 'all',
            sortBy: this.sortBy,
          })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        this.seminars = response.data || [];
        this.meta = response.meta || this.meta;
        this.summary = response.summary || this.summary;
        this.pageInput = this.meta.currentPage;
      } else {
        this.resetResults();
      }
    } catch (error) {
      console.error(error);
      this.resetResults();
    } finally {
      this.loading = false;
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

  getCreatorInitial(seminar: SeminarItem): string {
    return seminar.createdByName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }

  formatPrice(value: number): string {
    if (!value) {
      return 'Free';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  formatDate(value: string): string {
    if (!value) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatTimeRange(seminar: SeminarItem): string {
    if (!seminar.startTime) {
      return 'N/A';
    }

    return seminar.endTime ? `${seminar.startTime} - ${seminar.endTime}` : seminar.startTime;
  }

  getTakeaways(seminar: SeminarItem, limit = 3): string[] {
    return seminar.takeaways.slice(0, limit);
  }

  private resetResults(): void {
    this.seminars = [];
    this.meta = {
      ...this.meta,
      currentPage: 1,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
    this.pageInput = 1;
  }
}
