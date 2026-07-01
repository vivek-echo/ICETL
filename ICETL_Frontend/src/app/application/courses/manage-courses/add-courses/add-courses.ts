import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { lastValueFrom, timeout } from 'rxjs';
import { Course } from '../../services/course';
import { OfflineCourseItem } from '../../services/offline-course';
import { ChangeDetectorRef } from '@angular/core';
import { ROLE } from '../../../../commonServices/constants.service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-add-courses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-courses.html',
  styleUrl: './add-courses.scss',
})
export class AddCourses implements OnInit {
  courseForm!: FormGroup;

  categories: any[] = [];
  parentAcademicCourses: OfflineCourseItem[] = [];
  instructorList: any[] = [];
  instructorSearchTerm = '';
  isInstructorPickerOpen = false;
  isParentCoursesLoading = false;
  parentCoursesMessage = '';

  previewImage = 'https://placehold.co/710x488';

  userProfile: any = localStorage.getItem('auth_user')
    ? JSON.parse(localStorage.getItem('auth_user') || '{}')
    : null;

  dropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'Unselect All',
    allowSearchFilter: true,
  };

  constructor(
    private fb: FormBuilder,
    private courseService: Course,
    private cdr: ChangeDetectorRef,
    private formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private spinner: NgxSpinnerService,
    private alertHelper: AlertHelperService,
  ) {
    this.courseForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(50)]],
      isSpecial: [false],
      category: ['', Validators.required],
      parentCourseId: [''],
      instructor: [[], Validators.required],
      duration: [1, [Validators.required, Validators.min(1)]],
      durationUnit: [1, Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      oldPrice: [0, [Validators.min(0)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
      courseHighlights: this.fb.array([this.fb.control('')]),
      thumbnail: [null],
      status: [0],
    });
  }

  ngOnInit(): void {
    this.applyInstructorSpecialCourseDefaults();
    this.getCourseCategories();
    this.getInstructorList();
  }

  get f() {
    return this.courseForm.controls;
  }

  get discountPercentage() {
    let price = this.f['price'].value || 0;
    let oldPrice = this.f['oldPrice'].value || 0;

    if (!price || !oldPrice) return 0;

    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  get selectedCategory() {
    return (
      this.categories.find((x) => x.id == this.f['category'].value)?.categoryName || 'Category'
    );
  }

  get isSpecialCourse(): boolean {
    const value = this.f['isSpecial'].value;

    return value === true || value === 1 || value === '1';
  }

  get isInstructorUser(): boolean {
    return Number(this.userProfile?.role) === ROLE.INSTRUCTOR;
  }

  get parentCoursePlaceholder(): string {
    if (!this.f['category'].value) {
      return 'Select category first';
    }

    if (this.isParentCoursesLoading) {
      return 'Loading courses...';
    }

    return 'Select Academic Course';
  }

  get instructorNames() {
    return this.f['instructor'].value?.map((x: any) => x.name).join(', ') || 'Instructor';
  }

  get selectedInstructors(): any[] {
    return this.f['instructor'].value || [];
  }

  get instructorPickerLabel(): string {
    const selected = this.selectedInstructors;

    if (!selected.length) {
      return 'Select instructor';
    }

    if (selected.length === 1) {
      return this.instructorOptionLabel(selected[0]);
    }

    return `${selected.length} instructors selected`;
  }

  get filteredInstructorList(): any[] {
    const term = this.instructorSearchTerm.trim().toLowerCase();

    if (!term) {
      return this.instructorList;
    }

    return this.instructorList.filter((instructor: any) =>
      this.instructorOptionLabel(instructor).toLowerCase().includes(term),
    );
  }

  instructorOptionLabel(instructor: any): string {
    const name = `${instructor?.name || 'Instructor'}`.trim();
    const code = this.getInstructorCode(instructor);

    return code ? `${name} (${code})` : name;
  }

  @HostListener('document:click', ['$event'])
  closeInstructorPickerOnOutsideClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isInstructorPickerOpen = false;
    }
  }

  toggleInstructorPicker(): void {
    if (this.isInstructorUser) {
      this.isInstructorPickerOpen = false;
      return;
    }

    this.isInstructorPickerOpen = !this.isInstructorPickerOpen;
  }

  setInstructorSearch(event: Event): void {
    this.instructorSearchTerm = (event.target as HTMLInputElement).value;
  }

  clearInstructorSearch(): void {
    this.instructorSearchTerm = '';
  }

  isInstructorSelected(instructor: any): boolean {
    return (this.f['instructor'].value || []).some((item: any) => item.id === instructor.id);
  }

  toggleInstructor(instructor: any, event: Event): void {
    if (this.isInstructorUser) {
      (event.target as HTMLInputElement).checked = true;
      this.applyInstructorSelectionDefaults();
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    const selectedInstructors = [...(this.f['instructor'].value || [])];

    this.courseForm.patchValue({
      instructor: checked
        ? [...selectedInstructors, instructor]
        : selectedInstructors.filter((item: any) => item.id !== instructor.id),
    });

    this.f['instructor'].markAsTouched();
  }

  getHighlights(): FormArray<FormControl<string | null>> {
    return this.courseForm.get('courseHighlights') as FormArray<FormControl<string | null>>;
  }

  addHighlight(): void {
    this.getHighlights().push(this.fb.control(''));
  }

  removeHighlight(index: number): void {
    const highlights = this.getHighlights();

    if (highlights.length <= 1) {
      highlights.at(0).setValue('');
      return;
    }

    highlights.removeAt(index);
  }

  async getCourseCategories() {
    const response: any = await lastValueFrom(
      this.courseService.getCourseCategories({
        status: '1',
      }),
    );

    if (response.status) {
      this.categories = [...response.data];

      this.cdr.detectChanges(); // important
    }
  }

  async getInstructorList() {
    let payload: any = {
      instructorId: '',
    };

    if (this.isInstructorUser) {
      payload.instructorId = this.userProfile.id;
    }

    const response: any = await lastValueFrom(
      this.courseService.getInstructorListByInstructorId(payload),
    );

    if (response.status) {
      this.instructorList = [...(response.data || [])];
      this.applyInstructorSelectionDefaults();

      this.cdr.detectChanges(); // important
    }
  }

  async onSpecialCourseToggle(): Promise<void> {
    const parentControl = this.courseForm.get('parentCourseId');

    if (this.isInstructorUser && !this.isSpecialCourse) {
      this.courseForm.patchValue({ isSpecial: true });
    }

    if (this.isSpecialCourse) {
      parentControl?.setValidators([Validators.required]);
      await this.loadParentAcademicCourses();
    } else {
      parentControl?.clearValidators();
      parentControl?.setValue('');
      this.parentAcademicCourses = [];
      this.parentCoursesMessage = '';
    }

    parentControl?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  async onCategoryChange(): Promise<void> {
    this.courseForm.patchValue({ parentCourseId: '' });
    this.parentAcademicCourses = [];
    this.parentCoursesMessage = '';

    if (this.isSpecialCourse) {
      await this.loadParentAcademicCourses();
    }
  }

  async loadParentAcademicCourses(): Promise<void> {
    const categoryId = Number(this.f['category'].value);

    this.parentAcademicCourses = [];
    this.parentCoursesMessage = '';

    if (!this.isSpecialCourse || !Number.isFinite(categoryId) || categoryId <= 0) {
      this.cdr.detectChanges();
      return;
    }

    this.isParentCoursesLoading = true;

    try {
      const response = await lastValueFrom(
        this.courseService
          .getAllOfflineCourses({
            page: 1,
            perPage: 'all',
            categoryId,
            isSpecial: 0,
            sortBy: 'newest',
          })
          .pipe(timeout(15000)),
      );

      const courses = response.status ? response.data || [] : [];
      this.parentAcademicCourses = courses.filter(
        (course: OfflineCourseItem) =>
          Number(course.categoryId) === categoryId && Number(course.isSpecial ?? 0) !== 1,
      );
      this.parentCoursesMessage = this.parentAcademicCourses.length
        ? ''
        : 'No academic courses found for this category.';
    } catch (error) {
      console.error(error);
      this.parentCoursesMessage = 'Unable to load academic courses.';
    } finally {
      this.isParentCoursesLoading = false;
      this.cdr.detectChanges();
    }
  }

  onParentCourseChange(): void {
    const parentCourseId = Number(this.f['parentCourseId'].value);
    const selectedCourse = this.parentAcademicCourses.find((course) => course.id === parentCourseId);

    if (!selectedCourse) {
      return;
    }

    this.courseForm.patchValue({
      description: selectedCourse.description || '',
    });
    this.setHighlightsFromCourse(this.getSelectedCourseHighlights(selectedCourse));
    this.f['description'].markAsDirty();
    this.f['description'].markAsTouched();
    this.cdr.detectChanges();
  }

  onThumbnailChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    // Save file in form
    this.courseForm.patchValue({
      thumbnail: file,
    });

    const reader = new FileReader();

    reader.onload = () => {
      this.previewImage = reader.result as string;

      // Force UI refresh
      this.cdr.detectChanges();
    };

    reader.readAsDataURL(file);
  }

  async submitCourse(): Promise<void> {
    try {
      if (!this.formValidationService.validateForm(this.courseForm, this.getFieldName, this.el)) {
        return;
      }

      // Confirmation popup
      const confirmed = await this.alertHelper.confirm(
        'Do you want to create this course?',
        'Create Course',
      );

      if (!confirmed) {
        return;
      }

      this.spinner.show();

      const formData = new FormData();

      Object.keys(this.courseForm.value).forEach((key) => {
        let value = this.courseForm.value[key];

        // Convert instructor object array -> ID array
        if (key === 'instructor') {
          value = JSON.stringify(value.map((item: any) => item.id));
        }

        if (key === 'courseHighlights') {
          value = JSON.stringify(
            (value || [])
              .map((item: string) => `${item}`.trim())
              .filter((item: string) => item.length > 0),
          );
        }

        if (key === 'isSpecial') {
          value = this.isSpecialCourse ? '1' : '0';
        }

        if (key === 'parentCourseId') {
          value = this.isSpecialCourse ? `${Number(value) || ''}` : '';
        }

        // Skip null/empty
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      const response: any = await lastValueFrom(this.courseService.createCourse(formData));

      if (response.status) {
        const courseCode = response.data?.code ? `\nCode: ${response.data.code}` : '';
        this.alertHelper.success(`Course created successfully!${courseCode}`);

        this.courseForm.reset({
          status: 0,
          title:'',
          isSpecial: this.isInstructorUser,
          category: '',
          parentCourseId: '',
          instructor: [],
          duration: 1,
          durationUnit: 1,
          price: 0,
          oldPrice: 0,
          description: '',
          courseHighlights: [''],
          thumbnail: null,
        });
        this.courseForm.get('parentCourseId')?.clearValidators();
        this.courseForm.get('parentCourseId')?.updateValueAndValidity();
        this.applyInstructorSpecialCourseDefaults();
        this.applyInstructorSelectionDefaults();
        this.parentAcademicCourses = [];
        this.parentCoursesMessage = '';
        this.getHighlights().clear();
        this.addHighlight();

        this.previewImage = 'https://placehold.co/710x488';
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      this.spinner.hide();
    }
  }

  getFieldName(field: string): string {
    const map: Record<string, string> = {
      title: 'Course Title',
      isSpecial: 'Special Course',
      category: 'Course Category',
      parentCourseId: 'Parent Academic Course',
      instructor: 'Instructor',
      duration: 'Course Duration',
      durationUnit: 'Duration Unit',
      price: 'Price',
      oldPrice: 'Old Price',
      description: 'Course Description',
      courseHighlights: "What You'll Learn",
      thumbnail: 'Course Thumbnail',
      status: 'Status',
    };

    return map[field] || field;
  }

  private getSelectedCourseHighlights(course: OfflineCourseItem): string[] {
    const courseData = course as unknown as Record<string, unknown>;
    const fields = [
      courseData['courseHighlights'],
      courseData['highlights'],
      courseData['keyOutcomes'],
      courseData['key_outcomes'],
      courseData['learningOutcomes'],
      courseData['learning_outcomes'],
    ];

    for (const field of fields) {
      const highlights = this.normalizeHighlights(field);

      if (highlights.length) {
        return highlights;
      }
    }

    return [];
  }

  private normalizeHighlights(value: unknown): string[] {
    let source = value;

    if (typeof source === 'string') {
      const trimmed = source.trim();

      if (!trimmed) {
        return [];
      }

      try {
        source = JSON.parse(trimmed);
      } catch {
        source = trimmed.split(/\r?\n|,/);
      }
    }

    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((highlight) => {
        if (typeof highlight === 'string' || typeof highlight === 'number') {
          return `${highlight}`.trim();
        }

        if (highlight && typeof highlight === 'object') {
          const row = highlight as Record<string, unknown>;

          return `${row['title'] || row['name'] || row['text'] || row['outcome'] || ''}`.trim();
        }

        return '';
      })
      .filter((highlight) => highlight.length > 0);
  }

  private setHighlightsFromCourse(highlights: string[]): void {
    const cleanHighlights = this.normalizeHighlights(highlights)
      .map((highlight) => `${highlight || ''}`.trim())
      .filter((highlight) => highlight.length > 0);
    const highlightControls = this.getHighlights();
    const nextHighlights = cleanHighlights.length ? cleanHighlights : [''];

    while (highlightControls.length < nextHighlights.length) {
      highlightControls.push(this.fb.control(''));
    }

    while (highlightControls.length > nextHighlights.length) {
      highlightControls.removeAt(highlightControls.length - 1);
    }

    nextHighlights.forEach((highlight, index) => {
      highlightControls.at(index).setValue(highlight);
      highlightControls.at(index).markAsDirty();
      highlightControls.at(index).markAsTouched();
    });

    highlightControls.markAsDirty();
    highlightControls.markAsTouched();
    highlightControls.updateValueAndValidity();
  }

  private applyInstructorSpecialCourseDefaults(): void {
    if (!this.isInstructorUser) {
      return;
    }

    const parentControl = this.courseForm.get('parentCourseId');
    this.courseForm.patchValue({ isSpecial: true }, { emitEvent: false });
    parentControl?.setValidators([Validators.required]);
    parentControl?.updateValueAndValidity();
  }

  private applyInstructorSelectionDefaults(): void {
    if (!this.isInstructorUser) {
      return;
    }

    const instructor = this.getLoggedInInstructorOption();

    if (!instructor) {
      return;
    }

    this.courseForm.patchValue({ instructor: [instructor] }, { emitEvent: false });
    this.f['instructor'].updateValueAndValidity({ emitEvent: false });
    this.isInstructorPickerOpen = false;
    this.instructorSearchTerm = '';
  }

  private getLoggedInInstructorOption(): any | null {
    const userId = Number(this.userProfile?.id);
    const matchingInstructor = Number.isFinite(userId)
      ? this.instructorList.find((instructor: any) => Number(instructor.id) === userId)
      : null;

    return matchingInstructor || this.instructorList[0] || null;
  }

  private getInstructorCode(instructor: any): string {
    return `${instructor?.code ?? instructor?.instructorCode ?? instructor?.instructor_code ?? ''}`.trim();
  }
}
