import { ChangeDetectorRef, Component, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';

import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { FormValidationRules } from '../../../../commonServices/form-validation-rules';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { NgxSpinnerService } from 'ngx-spinner';
import { Course } from '../../services/course';
import { environment } from '../../../../../environments/environment';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';

interface CourseCategory {
  id: number;
  categoryName: string;
  slug: string;
  status: number | string;
  icon: string | null;
  iconUrl?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CourseCategoryResponse {
  status: boolean;
  message: string;
  data: CourseCategory[];
}

interface CategoryActionResponse {
  success?: boolean;
  status?: boolean;
  message: string;
  data?: CourseCategory | null;
  errors?: Record<string, string[]>;
}

@Component({
  selector: 'app-view-courses-categories',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './view-courses-categories.html',
  styleUrl: './view-courses-categories.scss',
})
export class ViewCoursesCategories implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private courseService = inject(Course);
  private readonly formValidationService = inject(FormValidationService);
  private readonly alertHelper = inject(AlertHelperService);
  private readonly spinner = inject(NgxSpinnerService);
  private readonly el = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private backendBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
  private editPreviewObjectUrl: string | null = null;

  loading = false;
  isSavingEdit = false;
  isEditModalOpen = false;

  search = '';

  status = '';

  categories: CourseCategory[] = [];
  editingCategory: CourseCategory | null = null;
  selectedEditFile: File | null = null;
  editIconPreview: string | null = null;

  editCategoryForm = this.fb.group({
    categoryName: ['', FormValidationRules.requiredName()],
    status: ['1', Validators.required],
    icon: [null as File | null],
  });

  metrics = [
    {
      label: 'Total Categories',
      value: 0,
      note: 'Available categories',
    },
    {
      label: 'Active',
      value: 0,
      note: 'Visible to learners',
    },
    {
      label: 'Inactive',
      value: 0,
      note: 'Hidden categories',
    },
  ];

  constructor() {
    afterNextRender(() => {
      void this.getCourseCategories();
    });
  }

  async getCourseCategories(): Promise<void> {
    this.loading = true;

    const payload = {
      search: this.search,
      status: this.status,
    };

    try {
      const response = (await lastValueFrom(
        this.courseService.getCourseCategories(payload).pipe(timeout(15000)),
      )) as CourseCategoryResponse;

      if (response.status) {
        this.categories = response.data;

        const active = this.categories.filter((item) => this.isActive(item.status)).length;

        const inactive = this.categories.filter((item) => !this.isActive(item.status)).length;

        this.metrics = [
          {
            label: 'Total Categories',
            value: this.categories.length,
            note: 'Available categories',
          },
          {
            label: 'Active',
            value: active,
            note: 'Visible categories',
          },
          {
            label: 'Inactive',
            value: inactive,
            note: 'Hidden categories',
          },
        ];
      } else {
        this.categories = [];
        this.resetMetrics();
      }
    } catch (error) {
      console.error(error);
      this.categories = [];
      this.resetMetrics();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onSearch(): void {
    void this.getCourseCategories();
  }

  trackByCategoryId(_: number, category: CourseCategory): number {
    return category.id;
  }

  isActive(status: number | string): boolean {
    return `${status}` === '1';
  }

  getStatusLabel(status: number | string): string {
    return this.isActive(status) ? 'Active' : 'Inactive';
  }

  getCategoryInitial(categoryName: string): string {
    return categoryName?.trim()?.charAt(0)?.toUpperCase() || 'C';
  }

  hasDisplayableIcon(category: CourseCategory): boolean {
    return this.getCategoryIconUrl(category) !== null;
  }

  getCategoryIconUrl(category: CourseCategory): string | null {
    if (category.iconUrl) {
      return category.iconUrl;
    }

    return this.resolveCategoryIcon(category.icon);
  }

  private resolveCategoryIcon(iconPath: string | null): string | null {
    if (!iconPath) {
      return null;
    }

    const normalizedPath = iconPath.trim();

    if (!normalizedPath) {
      return null;
    }

    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }

    if (normalizedPath.startsWith('/storage/') || normalizedPath.startsWith('storage/')) {
      const sanitizedPath = normalizedPath.replace(/^\/+/, '');
      return `${this.backendBaseUrl}/${sanitizedPath}`;
    }

    return null;
  }

  onCategoryIconError(category: CourseCategory): void {
    category.icon = null;
    category.iconUrl = null;
  }

  openEditModal(category: CourseCategory): void {
    this.editingCategory = category;
    this.isEditModalOpen = true;
    this.selectedEditFile = null;
    this.clearEditPreviewObjectUrl();
    this.editIconPreview = this.getCategoryIconUrl(category);

    this.editCategoryForm.reset({
      categoryName: category.categoryName,
      status: `${category.status}`,
      icon: null,
    });
  }

  closeEditModal(): void {
    if (this.isSavingEdit) {
      return;
    }

    this.isEditModalOpen = false;
    this.editingCategory = null;
    this.selectedEditFile = null;
    this.clearEditPreviewObjectUrl();
    this.editIconPreview = null;
    this.editCategoryForm.reset({
      categoryName: '',
      status: '1',
      icon: null,
    });
  }

  onEditFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      this.selectedEditFile = null;
      this.editCategoryForm.patchValue({ icon: null });
      this.clearEditPreviewObjectUrl();
      this.editIconPreview = this.editingCategory ? this.getCategoryIconUrl(this.editingCategory) : null;
      return;
    }

    const file = input.files[0];

    this.selectedEditFile = file;
    this.editCategoryForm.patchValue({
      icon: file,
    });

    this.clearEditPreviewObjectUrl();
    this.editPreviewObjectUrl = URL.createObjectURL(file);
    this.editIconPreview = this.editPreviewObjectUrl;
  }

  async submitEditCategory(): Promise<void> {
    if (!this.editingCategory) {
      return;
    }

    if (
      !this.formValidationService.validateForm(
        this.editCategoryForm as any,
        this.getEditFieldName,
        this.el,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.append('id', `${this.editingCategory.id}`);
    formData.append('categoryName', `${this.editCategoryForm.value.categoryName ?? ''}`.trim());
    formData.append('status', `${this.editCategoryForm.value.status ?? '1'}`);

    if (this.selectedEditFile) {
      formData.append('icon', this.selectedEditFile);
    }

    this.isSavingEdit = true;

    try {
      this.spinner.show();
      const response = (await lastValueFrom(
        this.courseService.updateCourseCategory(formData),
      )) as CategoryActionResponse;

      if (response.success || response.status) {
        await this.alertHelper.success(response.message || 'Course category updated successfully');
        this.closeEditModal();
        await this.getCourseCategories();
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
    } finally {
      this.isSavingEdit = false;
      this.spinner.hide();
    }
  }

  async confirmDeleteCategory(category: CourseCategory): Promise<void> {
    const confirmed = await this.alertHelper.confirm(
      `Do you want to delete "${category.categoryName}"? This action cannot be undone.`,
      'Delete Course Category',
    );

    if (!confirmed) {
      return;
    }

    try {
      this.spinner.show();
      const response = (await lastValueFrom(
        this.courseService.deleteCourseCategory({ id: category.id }),
      )) as CategoryActionResponse;

      if (response.success || response.status) {
        await this.alertHelper.success(response.message || 'Course category deleted successfully');

        if (this.editingCategory?.id === category.id) {
          this.closeEditModal();
        }

        await this.getCourseCategories();
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
    } finally {
      this.spinner.hide();
    }
  }

  getEditFieldName(field: string): string {
    const map: Record<string, string> = {
      categoryName: 'Category Name',
      status: 'Status',
      icon: 'Category Icon',
    };

    return map[field] || field;
  }

  ngOnDestroy(): void {
    this.clearEditPreviewObjectUrl();
  }

  private clearEditPreviewObjectUrl(): void {
    if (this.editPreviewObjectUrl) {
      URL.revokeObjectURL(this.editPreviewObjectUrl);
      this.editPreviewObjectUrl = null;
    }
  }

  private extractErrorMessage(error: any): string {
    const apiError = error?.error;

    if (apiError?.errors && typeof apiError.errors === 'object') {
      const firstFieldErrors = Object.values(apiError.errors)[0];

      if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
        return firstFieldErrors[0];
      }
    }

    return apiError?.message || 'Something went wrong. Please try again.';
  }

  private resetMetrics(): void {
    this.metrics = [
      {
        label: 'Total Categories',
        value: 0,
        note: 'Available categories',
      },
      {
        label: 'Active',
        value: 0,
        note: 'Visible to learners',
      },
      {
        label: 'Inactive',
        value: 0,
        note: 'Hidden categories',
      },
    ];
  }
}
