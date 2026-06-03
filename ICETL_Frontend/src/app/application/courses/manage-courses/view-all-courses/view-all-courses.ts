import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, timeout } from 'rxjs';
import { Course } from '../../services/course';

interface CourseCategory {
  id: number;
  categoryName: string;
}

interface CourseItem {
  id: number;
  title: string;
  categoryName: string;
  instructorName: string;
  duration: number | string | null;
  durationUnit: number | string | null;
  price: number | string;
  oldPrice: number | string | null;
  description: string | null;
  courseHighlights?: string[] | string | null;
  thumbnailUrl: string | null;
  status: number | string;
  courseType?: number | string;
  statusLabel: string;
  createdOn: string | null;
  createdByName: string;
  createdByEmail: string | null;
}

interface CoursePaginationMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

interface CourseListResponse {
  status: boolean;
  message: string;
  data: CourseItem[];
  meta: CoursePaginationMeta;
  summary?: {
    totalCourses: number;
    activeCourses: number;
    inactiveCourses: number;
  };
}

type CourseSortOption = 'newest' | 'popular' | 'priceLowHigh' | 'priceHighLow';

@Component({
  selector: 'app-view-all-courses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-all-courses.html',
  styleUrl: './view-all-courses.scss',
})
export class ViewAllCourses implements OnInit {
  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly sortOptions: Array<{ value: CourseSortOption; label: string }> = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Popular' },
    { value: 'priceLowHigh', label: 'Price Low to High' },
    { value: 'priceHighLow', label: 'Price High to Low' },
  ];
  private readonly minimumSearchLength = 4;
  private activeSearchTerm = '';

  loading = false;
  isCategoryDropdownOpen = false;
  search = '';
  categorySearch = '';
  status = '';
  sortBy: CourseSortOption = 'newest';
  pageInput = 1;

  categories: CourseCategory[] = [];
  selectedCategories: CourseCategory[] = [];
  courses: CourseItem[] = [];
  meta: CoursePaginationMeta = {
    currentPage: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
    from: null,
    to: null,
  };

  metrics = [
    {
      label: 'Total Courses',
      value: 0,
      note: 'Courses across all creators',
      icon: 'feather-book-open',
    },
    {
      label: 'Active',
      value: 0,
      note: 'Visible courses',
      icon: 'feather-check-circle',
    },
    {
      label: 'Inactive',
      value: 0,
      note: 'Hidden courses',
      icon: 'feather-eye-off',
    },
  ];

  constructor(
    private courseService: Course,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadCategories();
    void this.getAllCourses();
  }

  @HostListener('document:click')
  closeCategoryDropdown(): void {
    this.isCategoryDropdownOpen = false;
  }

  async loadCategories(): Promise<void> {
    try {
      const response: any = await lastValueFrom(
        this.courseService.getCourseCategories({ status: '1' }).pipe(timeout(15000)),
      );

      if (response.status) {
        this.categories = response.data || [];
      }
    } catch (error) {
      console.error(error);
      this.categories = [];
    } finally {
      this.markViewForRefresh();
    }
  }

  async getAllCourses(page = 1): Promise<void> {
    this.loading = true;

    const payload = {
      page,
      perPage: this.meta.perPage,
      search: this.normalizedSearchTerm,
      categoryIds: this.selectedCategories.map((category) => category.id),
      status: this.status,
      sortBy: this.sortBy,
    };

    try {
      const response = (await lastValueFrom(
        this.courseService.getAllCourses(payload).pipe(timeout(15000)),
      )) as CourseListResponse;

      if (response.status) {
        this.courses = this.getOnlineCourses(response.data || []);
        this.meta = response.meta || this.meta;
        this.pageInput = this.meta.currentPage;
        this.updateMetrics(response.summary);
      } else {
        this.courses = [];
        this.resetPagination();
        this.updateMetrics();
      }
    } catch (error) {
      console.error(error);
      this.courses = [];
      this.resetPagination();
      this.updateMetrics();
    } finally {
      this.loading = false;
      this.markViewForRefresh();
    }
  }

  onSearch(): void {
    const currentSearchTerm = this.search.trim();
    const nextSearchTerm = this.normalizedSearchTerm;

    if (currentSearchTerm.length > 0 && currentSearchTerm.length < this.minimumSearchLength) {
      if (this.activeSearchTerm === '') {
        return;
      }

      this.activeSearchTerm = '';
      void this.getAllCourses(1);
      return;
    }

    if (nextSearchTerm === this.activeSearchTerm) {
      return;
    }

    this.activeSearchTerm = nextSearchTerm;
    void this.getAllCourses(1);
  }

  onFilterChange(): void {
    void this.getAllCourses(1);
  }

  toggleCategoryDropdown(event: Event): void {
    event.stopPropagation();
    this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
  }

  keepCategoryDropdownOpen(event: Event): void {
    event.stopPropagation();
  }

  toggleCategory(category: CourseCategory): void {
    if (this.isCategorySelected(category.id)) {
      this.selectedCategories = this.selectedCategories.filter((item) => item.id !== category.id);
    } else {
      this.selectedCategories = [...this.selectedCategories, category];
    }

    void this.getAllCourses(1);
  }

  selectAllCategories(): void {
    this.selectedCategories = [...this.categories];
    void this.getAllCourses(1);
  }

  clearCategories(): void {
    this.selectedCategories = [];
    this.categorySearch = '';
    void this.getAllCourses(1);
  }

  onPerPageChange(): void {
    void this.getAllCourses(1);
  }

  onSortChange(): void {
    void this.getAllCourses(1);
  }

  clearFilters(): void {
    this.search = '';
    this.categorySearch = '';
    this.selectedCategories = [];
    this.status = '';
    this.sortBy = 'newest';
    this.activeSearchTerm = '';
    this.meta.perPage = 10;
    void this.getAllCourses(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.getAllCourses(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.getAllCourses(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.getAllCourses(page);
  }

  trackByCourseId(_: number, course: CourseItem): number {
    return course.id;
  }

  courseImage(course: CourseItem): string {
    return course.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(course: CourseItem): void {
    course.thumbnailUrl = null;
  }

  getCreatorInitial(course: CourseItem): string {
    return course.createdByName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }

  getDiscount(course: CourseItem): string | null {
    const price = this.toNumericPrice(course.price);
    const oldPrice = this.toNumericPrice(course.oldPrice);

    if (!oldPrice || !price || oldPrice <= price) {
      return null;
    }

    return `-${Math.round(((oldPrice - price) / oldPrice) * 100)}%`;
  }

  formatPrice(value: number | string | null): string {
    const price = this.toNumericPrice(value);

    if (price === null) {
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

  isActive(course: CourseItem): boolean {
    return `${course.status}` === '1';
  }

  getDurationLabel(course: CourseItem): string {
    if (!course.duration) {
      return 'N/A';
    }

    const unit = Number(course.durationUnit) === 2 ? 'Month(s)' : 'Week(s)';

    return `${course.duration} ${unit}`;
  }

  getCourseHighlights(course: CourseItem, limit?: number): string[] {
    const highlights = this.normalizeHighlights(course.courseHighlights);

    return typeof limit === 'number' ? highlights.slice(0, limit) : highlights;
  }

  getRemainingHighlightsCount(course: CourseItem, shownCount = 3): number {
    return Math.max(this.getCourseHighlights(course).length - shownCount, 0);
  }

  isCategorySelected(categoryId: number): boolean {
    return this.selectedCategories.some((category) => category.id === categoryId);
  }

  get filteredCategories(): CourseCategory[] {
    const searchTerm = this.categorySearch.trim().toLowerCase();

    if (!searchTerm) {
      return this.categories;
    }

    return this.categories.filter((category) =>
      category.categoryName.toLowerCase().includes(searchTerm),
    );
  }

  get selectedCategoryLabel(): string {
    if (this.selectedCategories.length === 0) {
      return 'All Categories';
    }

    if (this.selectedCategories.length === 1) {
      return this.selectedCategories[0].categoryName;
    }

    return `${this.selectedCategories.length} Categories`;
  }

  private updateMetrics(summary?: CourseListResponse['summary']): void {
    this.metrics = [
      {
        label: 'Total Courses',
        value: summary?.totalCourses || 0,
        note: 'Courses across all creators',
        icon: 'feather-book-open',
      },
      {
        label: 'Active',
        value: summary?.activeCourses || 0,
        note: 'Visible courses',
        icon: 'feather-check-circle',
      },
      {
        label: 'Inactive',
        value: summary?.inactiveCourses || 0,
        note: 'Hidden courses',
        icon: 'feather-eye-off',
      },
    ];
  }

  private getOnlineCourses(courses: CourseItem[]): CourseItem[] {
    return courses.filter((course) => `${course.courseType ?? 1}` !== '2');
  }

  private resetPagination(): void {
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

  private get normalizedSearchTerm(): string {
    const searchTerm = this.search.trim();

    return searchTerm.length >= this.minimumSearchLength ? searchTerm : '';
  }

  private markViewForRefresh(): void {
    this.cdr.markForCheck();
  }

  private toNumericPrice(value: number | string | null): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const plainTextValue = value
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const numericText = plainTextValue.match(/-?\d+(\.\d+)?/)?.[0] || '';
    const price = Number(numericText);

    return Number.isFinite(price) ? price : null;
  }

  private normalizeHighlights(value: string[] | string | null | undefined): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => `${item}`.trim()).filter((item) => item.length > 0);
    }

    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed.map((item) => `${item}`.trim()).filter((item) => item.length > 0)
        : [];
    } catch {
      return [];
    }
  }
}
