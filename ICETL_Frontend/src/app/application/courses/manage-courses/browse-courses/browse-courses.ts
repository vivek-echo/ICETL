import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { Course } from '../../services/course';
import { CourseCart, CourseCartItem } from '../../services/cart';

interface CourseCategory {
  id: number;
  categoryName: string;
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
  data: CourseCartItem[];
  meta: CoursePaginationMeta;
}

type CourseSortOption = 'newest' | 'popular' | 'priceLowHigh' | 'priceHighLow';

@Component({
  selector: 'app-browse-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './browse-courses.html',
  styleUrl: './browse-courses.scss',
})
export class BrowseCourses implements OnInit {
  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly perPageOptions: Array<number | 'all'> = [10, 20, 50, 100, 'all'];
  readonly sortOptions: Array<{ value: CourseSortOption; label: string }> = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Popular' },
    { value: 'priceLowHigh', label: 'Price Low to High' },
    { value: 'priceHighLow', label: 'Price High to Low' },
  ];
  readonly skeletonRows = Array.from({ length: 8 }, (_, index) => index);
  private readonly minimumSearchLength = 4;
  private activeSearchTerm = '';

  loading = false;
  search = '';
  categoryId: number | '' = '';
  sortBy: CourseSortOption = 'newest';
  pageInput = 1;
  categories: CourseCategory[] = [];
  courses: CourseCartItem[] = [];
  cartItems: CourseCartItem[] = [];
  addingCourseIds = new Set<number>();
  message = '';

  meta: CoursePaginationMeta = {
    currentPage: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
    from: null,
    to: null,
  };

  constructor(
    private courseService: Course,
    private cartService: CourseCart,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cartService.items$.subscribe((items) => {
      this.cartItems = items;
      this.cdr.markForCheck();
    });

    void this.cartService.loadCart();
    void this.loadCategories();
    void this.loadCourses();
  }

  async loadCategories(): Promise<void> {
    try {
      const response: any = await lastValueFrom(
        this.courseService.getCourseCategories({ status: '1' }).pipe(timeout(15000)),
      );

      this.categories = response.status ? response.data || [] : [];
    } catch (error) {
      console.error(error);
      this.categories = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadCourses(page = 1): Promise<void> {
    this.loading = true;

    const payload = {
      page,
      perPage: this.meta.perPage,
      search: this.normalizedSearchTerm,
      categoryIds: this.categoryId ? [this.categoryId] : [],
      sortBy: this.sortBy,
      status: '1',
    };

    try {
      const response = (await lastValueFrom(
        this.courseService.getAllCourses(payload).pipe(timeout(15000)),
      )) as CourseListResponse;

      this.courses = response.status ? response.data || [] : [];
      this.meta = response.status && response.meta ? response.meta : this.emptyMeta();
      this.pageInput = this.meta.currentPage;
    } catch (error) {
      console.error(error);
      this.courses = [];
      this.meta = this.emptyMeta();
      this.pageInput = 1;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onSearch(): void {
    const rawSearchTerm = this.search.trim();
    const nextSearchTerm = this.normalizedSearchTerm;

    if (rawSearchTerm.length > 0 && rawSearchTerm.length < this.minimumSearchLength) {
      if (!this.activeSearchTerm) {
        return;
      }

      this.activeSearchTerm = '';
      void this.loadCourses(1);
      return;
    }

    if (nextSearchTerm === this.activeSearchTerm) {
      return;
    }

    this.activeSearchTerm = nextSearchTerm;
    void this.loadCourses(1);
  }

  onFilterChange(): void {
    void this.loadCourses(1);
  }

  onPerPageChange(): void {
    void this.loadCourses(1);
  }

  onSortChange(): void {
    void this.loadCourses(1);
  }

  clearFilters(): void {
    this.search = '';
    this.categoryId = '';
    this.sortBy = 'newest';
    this.activeSearchTerm = '';
    this.meta.perPage = 10;
    void this.loadCourses(1);
  }

  async addToCart(course: CourseCartItem): Promise<void> {
    if (this.isInCart(course.id) || this.addingCourseIds.has(course.id)) {
      return;
    }

    this.addingCourseIds.add(course.id);

    try {
      await this.cartService.addItem(course);
      this.message = this.isInCart(course.id) ? 'Course added to your cart.' : '';
    } finally {
      this.addingCourseIds.delete(course.id);
      this.cdr.markForCheck();
    }
  }

  async buyNow(course: CourseCartItem): Promise<void> {
    await this.cartService.addItem(course);
    void this.router.navigate(['/application/yourCart']);
  }

  isInCart(courseId: number): boolean {
    return this.cartItems.some((item) => item.id === courseId);
  }

  isAdding(courseId: number): boolean {
    return this.addingCourseIds.has(courseId);
  }

  courseImage(course: CourseCartItem): string {
    return course.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(course: CourseCartItem): void {
    course.thumbnailUrl = null;
  }

  getDurationLabel(course: CourseCartItem): string {
    if (!course.duration) {
      return 'N/A';
    }

    const unit = Number(course.durationUnit) === 2 ? 'Month(s)' : 'Week(s)';

    return `${course.duration} ${unit}`;
  }

  getInstructorInitial(course: CourseCartItem): string {
    const name = course.instructorName || course.title || 'Instructor';

    return name.trim().charAt(0).toUpperCase() || 'I';
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

  trackByCourseId(_: number, course: CourseCartItem): number {
    return course.id;
  }

  get cartCount(): number {
    return this.cartItems.length;
  }

  get sortedCourses(): CourseCartItem[] {
    return this.courses;
  }

  get cartTotal(): number {
    return this.cartItems.reduce((total, item) => total + this.coursePrice(item), 0);
  }

  get learningProgress(): number {
    if (!this.meta.total) {
      return 0;
    }

    return Math.min(100, Math.round((this.cartCount / this.meta.total) * 100));
  }

  get recommendedCourses(): CourseCartItem[] {
    return this.sortedCourses.filter((course) => !this.isInCart(course.id)).slice(0, 3);
  }

  formatAmount(amount: number | string | null): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  }

  getRating(course: CourseCartItem): string {
    return (4.6 + (this.ratingSeed(course) % 4) / 10).toFixed(1);
  }

  getStudentCount(course: CourseCartItem): string {
    return `${620 + this.ratingSeed(course) * 37}`;
  }

  getDiscountPercent(course: CourseCartItem): number {
    const oldPrice = Number(course.oldPrice) || 0;
    const currentPrice = this.coursePrice(course);

    if (!oldPrice || oldPrice <= currentPrice) {
      return 0;
    }

    return Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  }

  getCourseHighlights(course: CourseCartItem, limit?: number): string[] {
    const highlights = this.normalizeHighlights(course.courseHighlights);

    return typeof limit === 'number' ? highlights.slice(0, limit) : highlights;
  }

  private coursePrice(course: CourseCartItem): number {
    return Number(course.price) || 0;
  }

  private ratingSeed(course: CourseCartItem): number {
    return ((course.id || 1) * 17) % 97;
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

  private get normalizedSearchTerm(): string {
    const searchTerm = this.search.trim();

    return searchTerm.length >= this.minimumSearchLength ? searchTerm : '';
  }

  private emptyMeta(): CoursePaginationMeta {
    return {
      currentPage: 1,
      perPage: this.meta.perPage,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }
}
