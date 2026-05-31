import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { FormValidationRules } from '../../../../commonServices/form-validation-rules';
import { ROLE } from '../../../../commonServices/constants.service';
import { Course } from '../../services/course';
import { OfflineCourseInstructor } from '../../services/offline-course';

interface CourseCategory {
  id: number;
  categoryName: string;
}

@Component({
  selector: 'app-add-offline-course',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-offline-course.html',
  styleUrl: './add-offline-course.scss',
})
export class AddOfflineCourse implements OnInit {
  courseForm: FormGroup;
  categories: CourseCategory[] = [];
  instructorList: OfflineCourseInstructor[] = [];
  instructorSearchTerm = '';
  isInstructorPickerOpen = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly courseService: Course,
    private readonly cdr: ChangeDetectorRef,
    private readonly formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private readonly spinner: NgxSpinnerService,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
  ) {
    this.courseForm = this.fb.group(
      {
        title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
        categoryId: ['', Validators.required],
        venue: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
        city: ['', FormValidationRules.requiredName()],
        startDate: ['', Validators.required],
        endDate: [''],
        startTime: ['', Validators.required],
        endTime: [''],
        youtubeLiveUrl: ['', [Validators.maxLength(255), Validators.pattern(/^https?:\/\/.+/i)]],
        meetingLink: ['', [Validators.maxLength(255), Validators.pattern(/^https?:\/\/.+/i)]],
        instructors: [[], Validators.required],
        price: [0, [Validators.required, Validators.min(0)]],
        description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
        highlights: this.fb.array([this.fb.control('')]),
        status: ['1', Validators.required],
      },
      {
        validators: [this.dateRangeValidator, this.timeRangeValidator],
      },
    );
  }

  ngOnInit(): void {
    void this.loadCategories();
    void this.loadInstructorList();
  }

  get f() {
    return this.courseForm.controls;
  }

  get highlights(): FormArray<FormControl<string | null>> {
    return this.courseForm.get('highlights') as FormArray<FormControl<string | null>>;
  }

  get selectedCategory(): string {
    const categoryId = Number(this.f['categoryId'].value);

    return this.categories.find((category) => category.id === categoryId)?.categoryName || 'Category';
  }

  get selectedInstructors(): OfflineCourseInstructor[] {
    return this.f['instructors'].value || [];
  }

  get instructorNames(): string {
    return this.selectedInstructors.map((instructor) => instructor.name).join(', ') || 'Instructor';
  }

  get instructorPickerLabel(): string {
    const selected = this.selectedInstructors;

    if (!selected.length) {
      return 'Select instructor';
    }

    if (selected.length === 1) {
      return selected[0].name;
    }

    return `${selected.length} instructors selected`;
  }

  get filteredInstructorList(): OfflineCourseInstructor[] {
    const term = this.instructorSearchTerm.trim().toLowerCase();

    if (!term) {
      return this.instructorList;
    }

    return this.instructorList.filter((instructor) =>
      `${instructor.name || ''}`.toLowerCase().includes(term),
    );
  }

  get dateRangeLabel(): string {
    const startDate = this.f['startDate'].value;
    const endDate = this.f['endDate'].value;

    if (!startDate) {
      return 'Date';
    }

    if (!endDate || endDate === startDate) {
      return this.formatDate(startDate);
    }

    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }

  get timeRangeLabel(): string {
    const startTime = this.f['startTime'].value;
    const endTime = this.f['endTime'].value;

    if (!startTime) {
      return 'Time';
    }

    return endTime ? `${startTime} - ${endTime}` : startTime;
  }

  get priceLabel(): string {
    const price = Number(this.f['price'].value);

    if (!Number.isFinite(price)) {
      return 'INR 0';
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
      this.cdr.markForCheck();
    }
  }

  async loadInstructorList(): Promise<void> {
    const userProfile = this.getStoredUser();
    const payload: any = {
      instructorId: '',
    };

    if (userProfile?.role === ROLE.INSTRUCTOR) {
      payload.instructorId = userProfile.id;
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
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  closeInstructorPickerOnOutsideClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isInstructorPickerOpen = false;
    }
  }

  toggleInstructorPicker(): void {
    this.isInstructorPickerOpen = !this.isInstructorPickerOpen;
  }

  setInstructorSearch(event: Event): void {
    this.instructorSearchTerm = (event.target as HTMLInputElement).value;
  }

  clearInstructorSearch(): void {
    this.instructorSearchTerm = '';
  }

  isInstructorSelected(instructor: OfflineCourseInstructor): boolean {
    return this.selectedInstructors.some((item) => item.id === instructor.id);
  }

  toggleInstructor(instructor: OfflineCourseInstructor, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selectedInstructors = [...this.selectedInstructors];

    this.courseForm.patchValue({
      instructors: checked
        ? [...selectedInstructors, instructor]
        : selectedInstructors.filter((item) => item.id !== instructor.id),
    });

    this.f['instructors'].markAsTouched();
  }

  addHighlight(): void {
    this.highlights.push(this.fb.control(''));
  }

  removeHighlight(index: number): void {
    if (this.highlights.length <= 1) {
      this.highlights.at(0).setValue('');
      return;
    }

    this.highlights.removeAt(index);
  }

  isInvalid(controlName: string): boolean {
    const control = this.courseForm.get(controlName);

    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getFieldError(controlName: string): string {
    const control = this.courseForm.get(controlName);

    if (!control || !(control.dirty || control.touched) || !control.errors) {
      return '';
    }

    const fieldName = this.getFieldName(controlName);

    if (control.errors['required']) {
      return `${fieldName} is required.`;
    }

    if (control.errors['minlength']) {
      return `${fieldName} must be at least ${control.errors['minlength'].requiredLength} characters.`;
    }

    if (control.errors['maxlength']) {
      return `${fieldName} cannot exceed ${control.errors['maxlength'].requiredLength} characters.`;
    }

    if (control.errors['min']) {
      return `${fieldName} cannot be less than ${control.errors['min'].min}.`;
    }

    if (control.errors['pattern']) {
      return `${fieldName} format is invalid.`;
    }

    if (control.errors['nameOnly']) {
      return `${fieldName} can contain only letters and spaces.`;
    }

    return `${fieldName} is invalid.`;
  }

  hasDateRangeError(): boolean {
    return (
      this.courseForm.hasError('dateRange') &&
      (this.f['endDate'].dirty || this.f['endDate'].touched)
    );
  }

  hasTimeRangeError(): boolean {
    return (
      this.courseForm.hasError('timeRange') &&
      (this.f['endTime'].dirty || this.f['endTime'].touched)
    );
  }

  resetForm(): void {
    this.courseForm.reset({
      title: '',
      categoryId: '',
      venue: '',
      city: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      youtubeLiveUrl: '',
      meetingLink: '',
      instructors: [],
      price: 0,
      description: '',
      highlights: [''],
      status: '1',
    });
    this.highlights.clear();
    this.addHighlight();
  }

  async submitCourse(): Promise<void> {
    if (!this.formValidationService.validateForm(this.courseForm, this.getFieldName, this.el)) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Do you want to add this offline course?',
      'Add Offline Course',
    );

    if (!confirmed) {
      return;
    }

    try {
      this.spinner.show();
      const response: any = await lastValueFrom(
        this.courseService.createOfflineCourse(this.getPayload()).pipe(timeout(20000)),
      );

      if (response.status) {
        await this.alertHelper.success(
          response.message || 'Offline course added successfully!',
        );
        this.resetForm();
        void this.router.navigate(['/application/courses/manageOfflineCourse/view']);
      }
    } catch (error) {
      console.error(error);
      await this.alertHelper.error(this.extractErrorMessage(error));
    } finally {
      this.spinner.hide();
    }
  }

  getFieldName(field: string): string {
    const map: Record<string, string> = {
      title: 'Course Title',
      categoryId: 'Category',
      venue: 'Venue',
      city: 'City',
      startDate: 'Start Date',
      endDate: 'End Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      youtubeLiveUrl: 'YouTube Live URL',
      meetingLink: 'Meeting Link',
      instructors: 'Instructor',
      price: 'Price',
      description: 'Description',
      highlights: 'Key Outcomes',
      status: 'Status',
    };

    return map[field] || field;
  }

  private getPayload(): Record<string, unknown> {
    const value = this.courseForm.value;
    const categoryId = Number(value.categoryId);

    return {
      title: `${value.title}`.trim(),
      category: Number.isFinite(categoryId) ? categoryId : null,
      instructor: this.selectedInstructors.map((instructor) => instructor.id),
      venue: `${value.venue}`.trim(),
      city: `${value.city}`.trim(),
      startDate: value.startDate,
      endDate: value.endDate || null,
      startTime: value.startTime,
      endTime: value.endTime || null,
      youtubeLiveUrl: this.normalizeOptionalText(value.youtubeLiveUrl),
      meetingLink: this.normalizeOptionalText(value.meetingLink),
      price: Number(value.price) || 0,
      description: `${value.description}`.trim(),
      courseHighlights: this.getCleanHighlights(),
      status: Number(value.status) === 0 ? 0 : 1,
    };
  }

  private getCleanHighlights(): string[] {
    return this.highlights.value
      .map((highlight) => `${highlight || ''}`.trim())
      .filter((highlight) => highlight.length > 0);
  }

  private normalizeOptionalText(value: unknown): string | null {
    const text = `${value || ''}`.trim();

    return text || null;
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return { dateRange: true };
    }

    return null;
  }

  private timeRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;
    const startTime = control.get('startTime')?.value;
    const endTime = control.get('endTime')?.value;

    if (
      startDate &&
      endDate &&
      startDate === endDate &&
      startTime &&
      endTime &&
      endTime <= startTime
    ) {
      return { timeRange: true };
    }

    return null;
  }

  private formatDate(value: string): string {
    if (!value) {
      return 'Date';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  private getStoredUser(): any {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      return JSON.parse(localStorage.getItem('auth_user') || '{}');
    } catch {
      return null;
    }
  }

  private extractErrorMessage(error: any): string {
    const apiError = error?.error;

    if (apiError?.errors && typeof apiError.errors === 'object') {
      const firstFieldErrors = Object.values(apiError.errors)[0];

      if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
        return `${firstFieldErrors[0]}`;
      }
    }

    return apiError?.message || 'Unable to add offline course. Please try again.';
  }
}
