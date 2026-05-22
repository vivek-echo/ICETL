import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { NgxSpinnerService } from 'ngx-spinner';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { ROLE } from '../../../../commonServices/constants.service';
import { Course } from '../../services/course';

interface CourseCategory {
  id: number;
  categoryName: string;
}

interface InstructorOption {
  id: number;
  name: string;
  email?: string;
}

interface CourseItem {
  id: number;
  title: string;
  categoryId: number | string;
  categoryName: string;
  instructors?: InstructorOption[];
  instructorName: string;
  duration: number | string | null;
  durationUnit: string | null;
  price: number | string;
  oldPrice: number | string | null;
  description: string | null;
  thumbnailUrl: string | null;
  status: number | string;
  statusLabel: string;
  createdOn: string | null;
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

interface EditCourseForm {
  id: number | null;
  title: string;
  category: string;
  instructors: InstructorOption[];
  duration: number | string;
  durationUnit: string;
  price: number | string;
  oldPrice: number | string | null;
  description: string;
  status: number | string;
}

@Component({
  selector: 'app-view-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, NgMultiSelectDropDownModule],
  templateUrl: './view-courses.html',
  styleUrl: './view-courses.scss',
})
export class ViewCourses implements OnInit, OnDestroy {
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
  readonly instructorDropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'Unselect All',
    allowSearchFilter: true,
    itemsShowLimit: 2,
  };

  loading = false;
  isEditModalOpen = false;
  isSavingEdit = false;
  isCategoryDropdownOpen = false;
  search = '';
  categorySearch = '';
  status = '';
  sortBy: CourseSortOption = 'newest';
  pageInput = 1;

  categories: CourseCategory[] = [];
  instructorList: InstructorOption[] = [];
  selectedCategories: CourseCategory[] = [];
  courses: CourseItem[] = [];
  editingCourse: CourseItem | null = null;
  selectedEditThumbnail: File | null = null;
  editPreviewImage = this.placeholderImage;
  private editPreviewObjectUrl: string | null = null;
  userProfile: any = localStorage.getItem('auth_user')
    ? JSON.parse(localStorage.getItem('auth_user') || '{}')
    : null;
  editCourseForm: EditCourseForm = this.getEmptyEditCourseForm();
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
      note: 'Courses added by you',
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
    private spinner: NgxSpinnerService,
    private alertHelper: AlertHelperService,
  ) {}

  ngOnInit(): void {
    void this.loadCategories();
    void this.loadInstructorList();
    void this.getCourses();
  }

  ngOnDestroy(): void {
    this.clearEditPreviewObjectUrl();
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

  async loadInstructorList(): Promise<void> {
    const payload: any = {
      instructorId: '',
    };

    if (this.userProfile?.role === ROLE.INSTRUCTOR) {
      payload.instructorId = this.userProfile.id;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService.getInstructorListByInstructorId(payload).pipe(timeout(15000)),
      );

      if (response.status) {
        this.instructorList = response.data || [];
      }
    } catch (error) {
      console.error(error);
      this.instructorList = [];
    } finally {
      this.markViewForRefresh();
    }
  }

  async getCourses(page = 1): Promise<void> {
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
        this.courseService.getCourses(payload).pipe(timeout(15000)),
      )) as CourseListResponse;

      if (response.status) {
        this.courses = response.data || [];
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
      void this.getCourses(1);
      return;
    }

    if (nextSearchTerm === this.activeSearchTerm) {
      return;
    }

    this.activeSearchTerm = nextSearchTerm;
    void this.getCourses(1);
  }

  onFilterChange(): void {
    void this.getCourses(1);
  }

  onCategoryFilterChange(): void {
    void this.getCourses(1);
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

    void this.getCourses(1);
  }

  selectAllCategories(): void {
    this.selectedCategories = [...this.categories];
    void this.getCourses(1);
  }

  clearCategories(): void {
    this.selectedCategories = [];
    this.categorySearch = '';
    void this.getCourses(1);
  }

  onPerPageChange(): void {
    void this.getCourses(1);
  }

  onSortChange(): void {
    void this.getCourses(1);
  }

  goToPreviousPage(): void {
    if (this.meta.currentPage <= 1) {
      return;
    }

    void this.getCourses(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.meta.currentPage >= this.meta.lastPage) {
      return;
    }

    void this.getCourses(this.meta.currentPage + 1);
  }

  goToPageInput(): void {
    const page = Math.min(Math.max(Number(this.pageInput) || 1, 1), this.meta.lastPage || 1);

    this.pageInput = page;

    if (page === this.meta.currentPage) {
      return;
    }

    void this.getCourses(page);
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

  openEditModal(course: CourseItem): void {
    this.editingCourse = course;
    this.selectedEditThumbnail = null;
    this.clearEditPreviewObjectUrl();
    this.editPreviewImage = this.courseImage(course);

    const selectedInstructors = (course.instructors || []).map((instructor) => {
      return this.instructorList.find((item) => item.id === instructor.id) || instructor;
    });

    this.editCourseForm = {
      id: course.id,
      title: course.title || '',
      category: course.categoryId ? `${course.categoryId}` : '',
      instructors: selectedInstructors,
      duration: course.duration ?? 1,
      durationUnit: course.durationUnit || 'weeks',
      price: course.price ?? 0,
      oldPrice: course.oldPrice ?? '',
      description: course.description || '',
      status: `${course.status}`,
    };

    setTimeout(() => {
      this.isEditModalOpen = true;
      this.markViewForRefresh();
    });
  }

  closeEditModal(): void {
    if (this.isSavingEdit) {
      return;
    }

    this.isEditModalOpen = false;
    this.editingCourse = null;
    this.selectedEditThumbnail = null;
    this.clearEditPreviewObjectUrl();
    this.editPreviewImage = this.placeholderImage;
    this.editCourseForm = this.getEmptyEditCourseForm();
    this.markViewForRefresh();
  }

  onEditThumbnailChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      this.selectedEditThumbnail = null;
      this.clearEditPreviewObjectUrl();
      this.editPreviewImage = this.editingCourse ? this.courseImage(this.editingCourse) : this.placeholderImage;
      this.markViewForRefresh();
      return;
    }

    const file = input.files[0];
    this.selectedEditThumbnail = file;
    this.clearEditPreviewObjectUrl();
    this.editPreviewObjectUrl = URL.createObjectURL(file);
    this.editPreviewImage = this.editPreviewObjectUrl;
    this.markViewForRefresh();
  }

  async submitEditCourse(): Promise<void> {
    if (!this.editingCourse || !this.editCourseForm.id) {
      return;
    }

    const validationMessage = this.getEditValidationMessage();

    if (validationMessage) {
      await this.alertHelper.error(validationMessage, 'Validation');
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Do you want to update this course?',
      'Update Course',
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.append('id', `${this.editCourseForm.id}`);
    formData.append('title', this.editCourseForm.title.trim());
    formData.append('category', `${this.editCourseForm.category}`);
    formData.append(
      'instructor',
      JSON.stringify(this.editCourseForm.instructors.map((instructor) => instructor.id)),
    );
    formData.append('duration', `${this.editCourseForm.duration}`);
    formData.append('durationUnit', this.editCourseForm.durationUnit);
    formData.append('price', `${this.editCourseForm.price}`);
    formData.append('description', this.editCourseForm.description.trim());
    formData.append('status', `${this.editCourseForm.status}`);

    if (this.editCourseForm.oldPrice !== null && this.editCourseForm.oldPrice !== '') {
      formData.append('oldPrice', `${this.editCourseForm.oldPrice}`);
    }

    if (this.selectedEditThumbnail) {
      formData.append('thumbnail', this.selectedEditThumbnail);
    }

    this.isSavingEdit = true;

    try {
      this.spinner.show();
      const response: any = await lastValueFrom(
        this.courseService.updateCourse(formData).pipe(timeout(20000)),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Course updated successfully');
        this.closeEditModal();
        await this.getCourses(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
    } finally {
      this.isSavingEdit = false;
      this.spinner.hide();
      this.markViewForRefresh();
    }
  }

  getInstructorInitial(course: CourseItem): string {
    return course.instructorName?.trim()?.charAt(0)?.toUpperCase() || 'I';
  }

  getDiscount(course: CourseItem): string | null {
    const price = Number(course.price);
    const oldPrice = Number(course.oldPrice);

    if (!oldPrice || !price || oldPrice <= price) {
      return null;
    }

    return `-${Math.round(((oldPrice - price) / oldPrice) * 100)}%`;
  }

  isActive(course: CourseItem): boolean {
    return `${course.status}` === '1';
  }

  isCategorySelected(categoryId: number): boolean {
    return this.selectedCategories.some((category) => category.id === categoryId);
  }

  getDurationLabel(course: CourseItem): string {
    if (!course.duration) {
      return 'N/A';
    }

    const unit = course.durationUnit === 'months' ? 'Month(s)' : 'Week(s)';

    return `${course.duration} ${unit}`;
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
        note: 'Courses added by you',
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

  private getEmptyEditCourseForm(): EditCourseForm {
    return {
      id: null,
      title: '',
      category: '',
      instructors: [],
      duration: 1,
      durationUnit: 'weeks',
      price: 0,
      oldPrice: '',
      description: '',
      status: '1',
    };
  }

  private clearEditPreviewObjectUrl(): void {
    if (this.editPreviewObjectUrl) {
      URL.revokeObjectURL(this.editPreviewObjectUrl);
      this.editPreviewObjectUrl = null;
    }
  }

  private getEditValidationMessage(): string {
    const title = this.editCourseForm.title.trim();
    const description = this.editCourseForm.description.trim();
    const duration = Number(this.editCourseForm.duration);
    const price = Number(this.editCourseForm.price);
    const oldPrice =
      this.editCourseForm.oldPrice === null || this.editCourseForm.oldPrice === ''
        ? null
        : Number(this.editCourseForm.oldPrice);

    if (title.length < 5 || title.length > 100) {
      return 'Course title must be between 5 and 100 characters.';
    }

    if (!this.editCourseForm.category) {
      return 'Please select a course category.';
    }

    if (!this.editCourseForm.instructors.length) {
      return 'Please select at least one instructor.';
    }

    if (Number.isNaN(duration) || duration < 1) {
      return 'Please enter a valid course duration.';
    }

    if (!['weeks', 'months'].includes(this.editCourseForm.durationUnit)) {
      return 'Please select a valid duration unit.';
    }

    if (Number.isNaN(price) || price < 0) {
      return 'Please enter a valid course price.';
    }

    if (oldPrice !== null && (Number.isNaN(oldPrice) || oldPrice < 0)) {
      return 'Please enter a valid old price.';
    }

    if (description.length < 20 || description.length > 300) {
      return 'Course description must be between 20 and 300 characters.';
    }

    return '';
  }

  private extractErrorMessage(error: any): string {
    const apiError = error?.error;

    if (apiError?.errors && typeof apiError.errors === 'object') {
      const firstFieldErrors = Object.values(apiError.errors)[0];

      if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
        return `${firstFieldErrors[0]}`;
      }
    }

    return apiError?.message || 'Something went wrong. Please try again.';
  }

  private markViewForRefresh(): void {
    this.cdr.markForCheck();
  }
}
