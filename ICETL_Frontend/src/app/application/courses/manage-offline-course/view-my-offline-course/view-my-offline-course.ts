import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { Course } from '../../services/course';
import { OfflineCourseItem } from '../../services/offline-course';

type OfflineCourseSortOption = 'newest' | 'oldest' | 'dateAsc' | 'dateDesc';

@Component({
  selector: 'app-view-my-offline-course',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './view-my-offline-course.html',
  styleUrl: './view-my-offline-course.scss',
})
export class ViewMyOfflineCourse implements OnInit {
  readonly sortOptions: Array<{ value: OfflineCourseSortOption; label: string }> = [
    { value: 'newest', label: 'Newest Added' },
    { value: 'oldest', label: 'Oldest Added' },
    { value: 'dateAsc', label: 'Start Date Asc' },
    { value: 'dateDesc', label: 'Start Date Desc' },
  ];

  courses: OfflineCourseItem[] = [];
  loading = false;
  search = '';
  city = '';
  status = '';
  sortBy: OfflineCourseSortOption = 'newest';

  constructor(
    private readonly courseService: Course,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    void this.loadCourses();
  }

  get filteredCourses(): OfflineCourseItem[] {
    const searchTerm = this.search.trim().toLowerCase();
    const cityFilter = this.city.trim().toLowerCase();
    const statusFilter = this.status;

    const filtered = this.courses.filter((course) => {
      const matchesSearch =
        !searchTerm ||
        [course.title, course.categoryName, course.venue, course.city, course.instructorName]
          .join(' ')
          .toLowerCase()
          .includes(searchTerm);
      const matchesCity = !cityFilter || course.city.toLowerCase() === cityFilter;
      const matchesStatus = statusFilter === '' || `${course.status}` === statusFilter;

      return matchesSearch && matchesCity && matchesStatus;
    });

    return this.sortCourses(filtered);
  }

  get cityOptions(): string[] {
    return [...new Set(this.courses.map((course) => course.city).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  get activeCourses(): number {
    return this.courses.filter((course) => this.isActive(course)).length;
  }

  get upcomingCourses(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.courses.filter((course) => course.startDate && new Date(course.startDate) >= today).length;
  }

  async loadCourses(): Promise<void> {
    this.loading = true;

    try {
      const response: any = await lastValueFrom(
        this.courseService.getOfflineCourses({}).pipe(timeout(15000)),
      );

      this.courses = response.status ? response.data || [] : [];
    } catch (error: any) {
      this.courses = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch offline courses.',
        'Offline Courses',
      );
    } finally {
      this.loading = false;
    }
  }

  clearFilters(): void {
    this.search = '';
    this.city = '';
    this.status = '';
    this.sortBy = 'newest';
  }

  goToAddCourse(): void {
    void this.router.navigate(['/application/courses/manageOfflineCourse/add']);
  }

  async deleteCourse(course: OfflineCourseItem): Promise<void> {
    const confirmed = await this.alertHelper.confirm(
      `Do you want to delete "${course.title}"?`,
      'Delete Offline Course',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService.deleteOfflineCourse({ id: course.id }).pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadCourses();
        await this.alertHelper.success(response.message || 'Offline course deleted successfully.');
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to delete offline course.',
        'Delete Offline Course',
      );
    }
  }

  async toggleStatus(course: OfflineCourseItem): Promise<void> {
    const nextStatus = this.isActive(course) ? 0 : 1;
    const confirmed = await this.alertHelper.confirm(
      `Do you want to mark this course as ${nextStatus === 1 ? 'active' : 'inactive'}?`,
      'Update Status',
    );

    if (!confirmed) {
      return;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService
          .updateOfflineCourseStatus({ id: course.id, status: nextStatus })
          .pipe(timeout(15000)),
      );

      if (response.status) {
        await this.loadCourses();
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to update offline course status.',
        'Update Status',
      );
    }
  }

  trackByCourseId(_: number, course: OfflineCourseItem): number {
    return course.id;
  }

  isActive(course: OfflineCourseItem): boolean {
    return Number(course.status) === 1;
  }

  getInitial(course: OfflineCourseItem): string {
    return course.instructorName?.trim()?.charAt(0)?.toUpperCase() || 'I';
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

  formatDateRange(course: OfflineCourseItem): string {
    if (!course.startDate) {
      return 'N/A';
    }

    const startDate = this.formatDate(course.startDate);

    if (!course.endDate || course.endDate === course.startDate) {
      return startDate;
    }

    return `${startDate} - ${this.formatDate(course.endDate)}`;
  }

  formatTimeRange(course: OfflineCourseItem): string {
    if (!course.startTime) {
      return 'N/A';
    }

    return course.endTime ? `${course.startTime} - ${course.endTime}` : course.startTime;
  }

  getExternalLinkUrl(value: string | null): string {
    const link = `${value || ''}`.trim();

    if (!link) {
      return '#';
    }

    return /^https?:\/\//i.test(link) ? link : `https://${link}`;
  }

  getHighlights(course: OfflineCourseItem, limit = 3): string[] {
    return course.highlights.slice(0, limit);
  }

  private sortCourses(courses: OfflineCourseItem[]): OfflineCourseItem[] {
    return [...courses].sort((left, right) => {
      if (this.sortBy === 'oldest') {
        return new Date(left.createdOn).getTime() - new Date(right.createdOn).getTime();
      }

      if (this.sortBy === 'dateAsc') {
        return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
      }

      if (this.sortBy === 'dateDesc') {
        return new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
      }

      return new Date(right.createdOn).getTime() - new Date(left.createdOn).getTime();
    });
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
