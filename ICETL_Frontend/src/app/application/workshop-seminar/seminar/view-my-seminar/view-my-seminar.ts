import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import {
  SeminarItem,
  SeminarScheduleFilter,
  SeminarService,
  SeminarSortOption,
} from '../../services/seminar';

@Component({
  selector: 'app-view-my-seminar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './view-my-seminar.html',
  styleUrl: './view-my-seminar.scss',
})
export class ViewMySeminar implements OnInit {
  readonly addRoute = '/application/workshopSeminar/seminar/add';
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

  constructor(
    private readonly seminarService: SeminarService,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    void this.loadSeminars();
  }

  get filteredSeminars(): SeminarItem[] {
    const searchTerm = this.search.trim().toLowerCase();
    const cityFilter = this.city.trim().toLowerCase();
    const statusFilter = this.status;
    const scheduleFilter = this.scheduleStatus;

    const filtered = this.seminars.filter((seminar) => {
      const matchesSearch =
        !searchTerm ||
        [
          seminar.title,
          seminar.topic,
          seminar.venue,
          seminar.city,
          seminar.speakerName,
          seminar.description,
        ]
          .join(' ')
          .toLowerCase()
          .includes(searchTerm);
      const matchesCity = !cityFilter || seminar.city.toLowerCase() === cityFilter;
      const matchesStatus = statusFilter === '' || `${seminar.status}` === statusFilter;
      const matchesSchedule =
        !scheduleFilter || scheduleFilter === 'all' || seminar.scheduleStatus === scheduleFilter;

      return matchesSearch && matchesCity && matchesStatus && matchesSchedule;
    });

    return this.sortPrograms(filtered);
  }

  get cityOptions(): string[] {
    return [...new Set(this.seminars.map((seminar) => seminar.city).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right),
    );
  }

  get activeSeminars(): number {
    return this.seminars.filter((seminar) => this.isActive(seminar)).length;
  }

  get upcomingSeminars(): number {
    return this.seminars.filter((seminar) => seminar.scheduleStatus === 'upcoming').length;
  }

  get completedSeminars(): number {
    return this.seminars.filter((seminar) => seminar.scheduleStatus === 'completed').length;
  }

  async loadSeminars(): Promise<void> {
    this.loading = true;

    try {
      const response = await lastValueFrom(
        this.seminarService.getMySeminars({}).pipe(timeout(15000)),
      );

      this.seminars = response.status ? response.data || [] : [];
    } catch (error: any) {
      this.seminars = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch seminars.',
        'Seminars',
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

  goToAddSeminar(): void {
    void this.router.navigate([this.addRoute]);
  }

  goToEditSeminar(seminar: SeminarItem): void {
    void this.router.navigate(['/application/workshopSeminar/seminar/edit', seminar.id]);
  }

  async deleteSeminar(seminar: SeminarItem): Promise<void> {
    const confirmed = await this.alertHelper.confirm(
      `Do you want to delete "${seminar.title}"?`,
      'Delete Seminar',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.seminarService.deleteSeminar({ id: seminar.id }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadSeminars();
        await this.alertHelper.success(response.message || 'Seminar deleted successfully.');
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to delete seminar.',
        'Delete Seminar',
      );
    }
  }

  async toggleStatus(seminar: SeminarItem): Promise<void> {
    const nextStatus = this.isActive(seminar) ? 0 : 1;
    const confirmed = await this.alertHelper.confirm(
      `Do you want to mark this seminar as ${nextStatus === 1 ? 'active' : 'inactive'}?`,
      'Update Status',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await lastValueFrom(
        this.seminarService
          .updateSeminarStatus({ id: seminar.id, status: nextStatus })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadSeminars();
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to update seminar status.',
        'Update Status',
      );
    }
  }

  trackByProgramId(_: number, seminar: SeminarItem): number {
    return seminar.id;
  }

  isActive(seminar: SeminarItem): boolean {
    return Number(seminar.status) === 1;
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

  private sortPrograms(programs: SeminarItem[]): SeminarItem[] {
    return [...programs].sort((left, right) => {
      if (this.sortBy === 'oldest') {
        return this.getDateTime(left.createdOn) - this.getDateTime(right.createdOn);
      }

      if (this.sortBy === 'dateAsc') {
        return this.getDateTime(left.eventDate) - this.getDateTime(right.eventDate);
      }

      if (this.sortBy === 'dateDesc') {
        return this.getDateTime(right.eventDate) - this.getDateTime(left.eventDate);
      }

      return this.getDateTime(right.createdOn) - this.getDateTime(left.createdOn);
    });
  }

  private getDateTime(value: string | null): number {
    const dateTime = value ? new Date(value).getTime() : 0;

    return Number.isFinite(dateTime) ? dateTime : 0;
  }
}
