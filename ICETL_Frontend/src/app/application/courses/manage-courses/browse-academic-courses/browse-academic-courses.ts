import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import { Course } from '../../services/course';
import {
  OfflineCourseItem,
  OfflineCourseListResponse,
  OfflineCoursePaginationMeta,
  OfflineCourseSummary,
} from '../../services/offline-course';

interface CourseCategory {
  id: number;
  categoryName: string;
}

type AcademicTimelineFilter = 'all' | 'upcoming' | 'ongoing';
type AcademicSortOption = 'newest' | 'dateAsc' | 'dateDesc';

@Component({
  selector: 'app-browse-academic-courses',
  imports: [CommonModule, FormsModule],
  templateUrl: './browse-academic-courses.html',
  styleUrl: './browse-academic-courses.scss',
})
export class BrowseAcademicCourses implements OnInit {
  readonly placeholderImage = 'assets/images/course/course-03.png';
  readonly perPageOptions = [10, 20, 50, 100];
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  readonly timelineFilters: Array<{ value: AcademicTimelineFilter; label: string }> = [
    { value: 'all', label: 'All Current' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ongoing', label: 'Ongoing' },
  ];
  readonly sortOptions: Array<{ value: AcademicSortOption; label: string }> = [
    { value: 'newest', label: 'Latest Created' },
    { value: 'dateAsc', label: 'Nearest Start' },
    { value: 'dateDesc', label: 'Latest Start' },
  ];

  private readonly minimumSearchLength = 3;
  private requestSerial = 0;

  loading = false;
  categoriesLoading = false;
  courses: OfflineCourseItem[] = [];
  categories: CourseCategory[] = [];
  search = '';
  city = '';
  categoryId: number | '' = '';
  timeline: AcademicTimelineFilter = 'all';
  sortBy: AcademicSortOption = 'newest';
  pageInput = 1;
  message = '';

  meta: OfflineCoursePaginationMeta = this.createDefaultMeta();
  summary: OfflineCourseSummary = this.createDefaultSummary();

  constructor(
    private readonly courseService: Course,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadCategories();
    void this.loadCourses();
  }

  async loadCategories(): Promise<void> {
    this.categoriesLoading = true;

    try {
      const response: any = await lastValueFrom(
        this.courseService.getCourseCategories({ status: '1' }).pipe(timeout(15000)),
      );

      this.categories = response.status ? response.data || [] : [];
    } catch (error) {
      console.error(error);
      this.categories = [];
    } finally {
      this.categoriesLoading = false;
      this.cdr.markForCheck();
    }
  }

  async loadCourses(page = 1): Promise<void> {
    const requestId = ++this.requestSerial;
    this.loading = true;
    this.message = '';
    this.cdr.markForCheck();

    const payload = {
      page,
      perPage: this.meta.perPage,
      search: this.normalizedSearchTerm,
      city: this.city.trim(),
      categoryIds: this.categoryId ? [Number(this.categoryId)] : [],
      status: '1',
      activeScheduleOnly: true,
      scheduleStatus: this.timeline === 'all' ? 'all' : this.timeline,
      sortBy: this.sortBy,
    };

    try {
      const response = (await lastValueFrom(
        this.courseService.getAllOfflineCourses(payload).pipe(timeout(15000)),
      )) as OfflineCourseListResponse;

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.status) {
        this.courses = response.data || [];
        this.meta = response.meta || this.createDefaultMeta();
        this.summary = response.summary || this.createDefaultSummary();
        this.pageInput = this.meta.currentPage;

        if (this.courses.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadCourses(this.meta.currentPage - 1);
        }
      } else {
        this.resetResults();
        this.message = response.message || 'No academic courses found.';
      }
    } catch (error: any) {
      if (requestId !== this.requestSerial) {
        return;
      }

      console.error(error);
      this.resetResults();
      this.message = error?.error?.message || 'Unable to load academic courses.';
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

    void this.loadCourses(1);
  }

  onFilterChange(): void {
    void this.loadCourses(1);
  }

  onPerPageChange(): void {
    void this.loadCourses(1);
  }

  selectTimeline(value: AcademicTimelineFilter): void {
    if (this.timeline === value) {
      return;
    }

    this.timeline = value;
    void this.loadCourses(1);
  }

  clearFilters(): void {
    this.search = '';
    this.city = '';
    this.categoryId = '';
    this.timeline = 'all';
    this.sortBy = 'newest';
    this.meta.perPage = 10;
    void this.loadCourses(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage > 1) {
      void this.loadCourses(this.meta.currentPage - 1);
    }
  }

  goToNextPage(): void {
    if (this.meta.currentPage < this.meta.lastPage) {
      void this.loadCourses(this.meta.currentPage + 1);
    }
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page !== this.meta.currentPage) {
      void this.loadCourses(page);
    }
  }

  trackByCourseId(_: number, course: OfflineCourseItem): number {
    return course.id;
  }

  courseImage(course: OfflineCourseItem): string {
    return course.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(course: OfflineCourseItem): void {
    course.thumbnailUrl = null;
  }

  getScheduleLabel(course: OfflineCourseItem): string {
    if (course.scheduleStatus === 'completed') {
      return 'Completed';
    }

    return course.scheduleStatus === 'ongoing' ? 'Ongoing' : 'Upcoming';
  }

  getScheduleClass(course: OfflineCourseItem): string {
    if (course.scheduleStatus === 'completed') {
      return 'is-completed';
    }

    return course.scheduleStatus === 'ongoing' ? 'is-ongoing' : 'is-upcoming';
  }

  getDateRange(course: OfflineCourseItem): string {
    const startDate = this.formatDate(course.startDate);
    const endDate = this.formatDate(course.endDate || '');

    if (!startDate && !endDate) {
      return 'Date TBA';
    }

    if (!endDate || startDate === endDate) {
      return startDate;
    }

    return `${startDate} - ${endDate}`;
  }

  getTimeRange(course: OfflineCourseItem): string {
    if (!course.startTime && !course.endTime) {
      return 'Time TBA';
    }

    if (!course.endTime) {
      return course.startTime || 'Time TBA';
    }

    return `${course.startTime} - ${course.endTime}`;
  }

  getLocation(course: OfflineCourseItem): string {
    return [course.venue, course.city].filter(Boolean).join(', ') || 'Venue TBA';
  }

  getInstructorLabel(course: OfflineCourseItem): string {
    return course.instructorName || course.instructors?.map((instructor) => instructor.name).join(', ') || 'Instructor';
  }

  getCourseHighlights(course: OfflineCourseItem, limit = 3): string[] {
    const highlights = course.courseHighlights?.length ? course.courseHighlights : course.highlights || [];

    return highlights.map((item) => `${item}`.trim()).filter(Boolean).slice(0, limit);
  }

  formatCreatedDate(value: string): string {
    return this.formatDate(value) || 'N/A';
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

  getPaginationLabel(): string {
    if (!this.meta.total) {
      return 'No academic courses found';
    }

    return `Showing ${this.meta.from || 0}-${this.meta.to || 0} of ${this.meta.total} courses`;
  }

  get selectedCategoryLabel(): string {
    if (!this.categoryId) {
      return 'All Categories';
    }

    return (
      this.categories.find((category) => category.id === Number(this.categoryId))?.categoryName ||
      'Selected Category'
    );
  }

  get activeFilterCount(): number {
    return [
      this.normalizedSearchTerm,
      this.city.trim(),
      this.categoryId,
      this.timeline !== 'all' ? this.timeline : '',
    ].filter(Boolean).length;
  }

  private get normalizedSearchTerm(): string {
    const searchTerm = this.search.trim();

    return searchTerm.length >= this.minimumSearchLength ? searchTerm : '';
  }

  private resetResults(): void {
    this.courses = [];
    this.meta = this.createDefaultMeta();
    this.summary = this.createDefaultSummary();
    this.pageInput = 1;
  }

  private createDefaultMeta(): OfflineCoursePaginationMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createDefaultSummary(): OfflineCourseSummary {
    return {
      totalCourses: 0,
      activeCourses: 0,
      inactiveCourses: 0,
      upcomingCourses: 0,
      ongoingCourses: 0,
      completedCourses: 0,
    };
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
