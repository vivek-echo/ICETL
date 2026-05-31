import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  meta: WorkshopPaginationMeta = {
    currentPage: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
    from: null,
    to: null,
  };
  summary: WorkshopSummary = {
    totalWorkshops: 0,
    activeWorkshops: 0,
    inactiveWorkshops: 0,
    upcomingWorkshops: 0,
    completedWorkshops: 0,
  };

  constructor(private readonly workshopService: WorkshopService) {}

  ngOnInit(): void {
    void this.loadWorkshops();
  }

  async loadWorkshops(page = 1): Promise<void> {
    this.loading = true;

    try {
      const response = await lastValueFrom(
        this.workshopService
          .getAllWorkshops({
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
        this.workshops = response.data || [];
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
    if (!value) {
      return 'Free';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
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
    return workshop.takeaways.slice(0, limit);
  }

  private resetResults(): void {
    this.workshops = [];
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

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
