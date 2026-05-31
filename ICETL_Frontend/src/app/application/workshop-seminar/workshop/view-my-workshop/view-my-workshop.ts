import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import {
  WorkshopItem,
  WorkshopScheduleFilter,
  WorkshopService,
  WorkshopSortOption,
} from '../../services/workshop';

@Component({
  selector: 'app-view-my-workshop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './view-my-workshop.html',
  styleUrl: './view-my-workshop.scss',
})
export class ViewMyWorkshop implements OnInit {
  readonly addRoute = '/application/workshopSeminar/workshop/add';
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

  constructor(
    private readonly workshopService: WorkshopService,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    void this.loadWorkshops();
  }

  get filteredWorkshops(): WorkshopItem[] {
    const searchTerm = this.search.trim().toLowerCase();
    const cityFilter = this.city.trim().toLowerCase();
    const statusFilter = this.status;
    const scheduleFilter = this.scheduleStatus;

    const filtered = this.workshops.filter((workshop) => {
      const matchesSearch =
        !searchTerm ||
        [
          workshop.title,
          workshop.topic,
          workshop.venue,
          workshop.city,
          workshop.speakerName,
          workshop.description,
        ]
          .join(' ')
          .toLowerCase()
          .includes(searchTerm);
      const matchesCity = !cityFilter || workshop.city.toLowerCase() === cityFilter;
      const matchesStatus = statusFilter === '' || `${workshop.status}` === statusFilter;
      const matchesSchedule =
        !scheduleFilter || scheduleFilter === 'all' || workshop.scheduleStatus === scheduleFilter;

      return matchesSearch && matchesCity && matchesStatus && matchesSchedule;
    });

    return this.sortPrograms(filtered);
  }

  get cityOptions(): string[] {
    return [...new Set(this.workshops.map((workshop) => workshop.city).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right),
    );
  }

  get activeWorkshops(): number {
    return this.workshops.filter((workshop) => this.isActive(workshop)).length;
  }

  get upcomingWorkshops(): number {
    return this.workshops.filter((workshop) => workshop.scheduleStatus === 'upcoming').length;
  }

  get completedWorkshops(): number {
    return this.workshops.filter((workshop) => workshop.scheduleStatus === 'completed').length;
  }

  async loadWorkshops(): Promise<void> {
    this.loading = true;

    try {
      const response = await lastValueFrom(
        this.workshopService.getMyWorkshops({}).pipe(timeout(15000)),
      );

      this.workshops = response.status ? response.data || [] : [];
    } catch (error: any) {
      this.workshops = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch workshops.',
        'Workshops',
      );
    } finally {
      this.loading = false;
    }
  }

  clearFilters(): void {
    this.search = '';
    this.city = '';
    this.status = '';
    this.scheduleStatus = '';
    this.sortBy = 'newest';
  }

  goToAddWorkshop(): void {
    void this.router.navigate([this.addRoute]);
  }

  goToEditWorkshop(workshop: WorkshopItem): void {
    void this.router.navigate(['/application/workshopSeminar/workshop/edit', workshop.id]);
  }

  async deleteWorkshop(workshop: WorkshopItem): Promise<void> {
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
        await this.loadWorkshops();
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
        await this.loadWorkshops();
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

  formatDate(value: string | null): string {
    if (!value) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
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

  private sortPrograms(programs: WorkshopItem[]): WorkshopItem[] {
    return [...programs].sort((left, right) => {
      if (this.sortBy === 'oldest') {
        return this.getDateTime(left.createdOn) - this.getDateTime(right.createdOn);
      }

      if (this.sortBy === 'dateAsc') {
        return this.getDateTime(left.startDate) - this.getDateTime(right.startDate);
      }

      if (this.sortBy === 'dateDesc') {
        return this.getDateTime(right.startDate) - this.getDateTime(left.startDate);
      }

      return this.getDateTime(right.createdOn) - this.getDateTime(left.createdOn);
    });
  }

  private getDateTime(value: string | null): number {
    const dateTime = value ? new Date(value).getTime() : 0;

    return Number.isFinite(dateTime) ? dateTime : 0;
  }
}
