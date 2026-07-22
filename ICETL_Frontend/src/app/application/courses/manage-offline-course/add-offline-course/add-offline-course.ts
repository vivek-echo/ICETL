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
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { ROLE } from '../../../../commonServices/constants.service';
import { Course } from '../../services/course';
import { OfflineCourseInstructor, OfflineCourseItem } from '../../services/offline-course';
import {
  AdministrationService,
  Branch,
  LocationDistrict,
  LocationState,
} from '../../../manage-administration/services/administration';

interface CourseCategory {
  id: number;
  categoryName: string;
}

type OfflineDateControl = 'startDate' | 'endDate';

interface CalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-add-offline-course',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-offline-course.html',
  styleUrl: './add-offline-course.scss',
})
export class AddOfflineCourse implements OnInit {
  readonly currentYear = new Date().getFullYear();
  readonly calendarWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly calendarMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  readonly calendarYearOptions = this.buildCalendarYearOptions();
  courseForm: FormGroup;
  categories: CourseCategory[] = [];
  states: LocationState[] = [];
  districts: LocationDistrict[] = [];
  branches: Branch[] = [];
  parentAcademicCourses: OfflineCourseItem[] = [];
  instructorList: OfflineCourseInstructor[] = [];
  instructorSearchTerm = '';
  isInstructorPickerOpen = false;
  isParentCoursesLoading = false;
  parentCoursesMessage = '';
  loadingStates = false;
  loadingDistricts = false;
  loadingBranches = false;
  selectedStateCode = '';
  selectedDistrictCode = '';
  openCalendar: OfflineDateControl | null = null;
  calendarViews: Record<OfflineDateControl, Date> = {
    startDate: this.defaultCalendarView(),
    endDate: this.defaultCalendarView(),
  };
  selectedBannerImage: File | null = null;
  bannerPreviewUrl: string | null = null;
  editCourseId: number | null = null;
  isEditMode = false;
  loadingCourse = false;
  private readonly maxBannerImageSize = 2 * 1024 * 1024;
  private readonly allowedBannerImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly dateNotBeforeTodayValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value || ''}`;

    if (!value) {
      return null;
    }

    if (!this.parseIsoDate(value)) {
      return { invalidDate: true };
    }

    if (this.isEditMode) {
      return null;
    }

    return value < this.todayIso() ? { dateInPast: true } : null;
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly courseService: Course,
    private readonly cdr: ChangeDetectorRef,
    private readonly formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private readonly spinner: NgxSpinnerService,
    private readonly alertHelper: AlertHelperService,
    private readonly router: Router,
    private readonly administrationService: AdministrationService,
  ) {
    this.courseForm = this.fb.group(
      {
        title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
        isSpecial: [false],
        categoryId: ['', Validators.required],
        parentCourseId: [''],
        stateCode: ['', Validators.required],
        districtCode: [{ value: '', disabled: true }, Validators.required],
        branchId: [{ value: '', disabled: true }, Validators.required],
        startDate: ['', [Validators.required, this.dateNotBeforeTodayValidator]],
        endDate: ['', [this.dateNotBeforeTodayValidator]],
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
    const editId = this.getEditCourseIdFromState();
    this.editCourseId = Number.isFinite(editId) && editId > 0 ? editId : null;
    this.isEditMode = this.editCourseId !== null;
    this.applyInstructorSpecialCourseDefaults();
    void this.initializeFormData();
  }

  private getEditCourseIdFromState(): number {
    const navigationState = this.router.getCurrentNavigation()?.extras.state as
      | { offlineCourseId?: number | string }
      | undefined;
    const browserState =
      typeof history !== 'undefined'
        ? (history.state as { offlineCourseId?: number | string } | undefined)
        : undefined;
    const editId = Number(navigationState?.offlineCourseId ?? browserState?.offlineCourseId);

    return Number.isFinite(editId) ? editId : 0;
  }

  async initializeFormData(): Promise<void> {
    await Promise.all([this.loadCategories(), this.loadInstructorList(), this.loadStates()]);

    if (this.editCourseId) {
      await this.loadCourseForEdit(this.editCourseId);
    }
  }

  get f() {
    return this.courseForm.controls;
  }

  get highlights(): FormArray<FormControl<string | null>> {
    return this.courseForm.get('highlights') as FormArray<FormControl<string | null>>;
  }

  get isSpecialCourse(): boolean {
    const value = this.f['isSpecial'].value;

    return value === true || value === 1 || value === '1';
  }

  get isInstructorUser(): boolean {
    return Number(this.getStoredUser()?.role) === ROLE.INSTRUCTOR;
  }

  get selectedCategory(): string {
    const categoryId = Number(this.f['categoryId'].value);

    return this.categories.find((category) => category.id === categoryId)?.categoryName || 'Category';
  }

  get selectedStateName(): string {
    const stateCode = Number(this.f['stateCode'].value || 0);

    return this.states.find((state) => Number(state.stateCode) === stateCode)?.stateName || '';
  }

  get selectedDistrictName(): string {
    const districtCode = Number(this.f['districtCode'].value || 0);

    return this.districts.find((district) => Number(district.districtCode) === districtCode)?.districtName || '';
  }

  get selectedBranch(): Branch | null {
    const branchId = Number(this.f['branchId'].value || 0);

    return this.branches.find((branch) => Number(branch.id) === branchId) || null;
  }

  get locationLabel(): string {
    return [this.selectedBranch?.branchName, this.selectedDistrictName, this.selectedStateName]
      .filter(Boolean)
      .join(', ') || 'Branch Location';
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
      return this.instructorOptionLabel(selected[0]);
    }

    return `${selected.length} instructors selected`;
  }

  get filteredInstructorList(): OfflineCourseInstructor[] {
    const term = this.instructorSearchTerm.trim().toLowerCase();

    if (!term) {
      return this.instructorList;
    }

    return this.instructorList.filter((instructor) =>
      this.instructorOptionLabel(instructor).toLowerCase().includes(term),
    );
  }

  instructorOptionLabel(instructor: OfflineCourseInstructor): string {
    const name = `${instructor?.name || 'Instructor'}`.trim();
    const code = this.getInstructorCode(instructor);

    return code ? `${name} (${code})` : name;
  }

  get parentCoursePlaceholder(): string {
    if (!this.f['categoryId'].value) {
      return 'Select category first';
    }

    if (this.isParentCoursesLoading) {
      return 'Loading courses...';
    }

    return 'Select Academic Course';
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

  get startDateDisplayValue(): string {
    return this.formatIsoDateForDisplay(`${this.f['startDate'].value || ''}`);
  }

  get endDateDisplayValue(): string {
    return this.formatIsoDateForDisplay(`${this.f['endDate'].value || ''}`);
  }

  get startDateCalendarDays(): CalendarDay[] {
    return this.buildCalendarDays('startDate');
  }

  get endDateCalendarDays(): CalendarDay[] {
    return this.buildCalendarDays('endDate');
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

  async loadStates(): Promise<void> {
    this.loadingStates = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(this.administrationService.getStates().pipe(timeout(15000)));
      this.states = response.status ? response.data : [];
    } catch (error: any) {
      this.states = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load states. Please try again.',
        'Course Location',
      );
    } finally {
      this.loadingStates = false;
      this.cdr.markForCheck();
    }
  }

  onStateChange(): void {
    this.selectedStateCode = `${this.courseForm.get('stateCode')?.value ?? ''}`;
    this.selectedDistrictCode = '';
    const stateCode = Number(this.selectedStateCode || 0);
    const districtControl = this.courseForm.get('districtCode');
    const branchControl = this.courseForm.get('branchId');

    districtControl?.reset('');
    branchControl?.reset('');
    this.districts = [];
    this.branches = [];
    branchControl?.disable();

    if (!stateCode) {
      districtControl?.disable();
      this.cdr.markForCheck();
      return;
    }

    districtControl?.enable();
    this.cdr.markForCheck();
    void this.loadDistricts(stateCode);
  }

  async loadDistricts(stateCode: number): Promise<void> {
    this.loadingDistricts = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(this.administrationService.getDistricts(stateCode).pipe(timeout(15000)));
      this.districts = response.status ? response.data : [];
    } catch (error: any) {
      this.districts = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load districts/cities. Please try again.',
        'Course Location',
      );
    } finally {
      this.loadingDistricts = false;
      this.cdr.markForCheck();
    }
  }

  onDistrictChange(): void {
    this.selectedDistrictCode = `${this.courseForm.get('districtCode')?.value ?? ''}`;
    const stateCode = Number(this.selectedStateCode || 0);
    const districtCode = Number(this.selectedDistrictCode || 0);
    const branchControl = this.courseForm.get('branchId');

    branchControl?.reset('');
    this.branches = [];

    if (!stateCode || !districtCode) {
      branchControl?.disable();
      this.cdr.markForCheck();
      return;
    }

    branchControl?.enable();
    this.cdr.markForCheck();
    void this.loadBranches(stateCode, districtCode);
  }

  async loadBranches(stateCode: number, districtCode: number): Promise<void> {
    this.loadingBranches = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.administrationService
          .getBranches({
            page: 1,
            perPage: 'all',
            stateCode,
            districtCode,
            status: '1',
          })
          .pipe(timeout(15000)),
      );
      this.branches = response.status ? response.data : [];
    } catch (error: any) {
      this.branches = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load branches. Please try again.',
        'Course Location',
      );
    } finally {
      this.loadingBranches = false;
      this.cdr.markForCheck();
    }
  }

  async loadInstructorList(): Promise<void> {
    const userProfile = this.getStoredUser();
    const payload: any = {
      instructorId: '',
    };

    if (this.isInstructorUser) {
      payload.instructorId = userProfile.id;
    }

    try {
      const response: any = await lastValueFrom(
        this.courseService.getInstructorListByInstructorId(payload).pipe(timeout(15000)),
      );

      if (response.status) {
        this.instructorList = response.data || [];
        this.applyInstructorSelectionDefaults();
      }
    } catch (error) {
      console.error(error);
      this.instructorList = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadCourseForEdit(courseId: number): Promise<void> {
    this.loadingCourse = true;

    try {
      const response: any = await lastValueFrom(
        this.courseService.getOfflineCourseById({ id: courseId }).pipe(timeout(15000)),
      );

      if (!response?.status || !response.data) {
        await this.alertHelper.error(response?.message || 'Unable to load offline course.');
        return;
      }

      await this.applyCourseForEdit(response.data as OfflineCourseItem);
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load offline course.',
        'Edit Offline Course',
      );
    } finally {
      this.loadingCourse = false;
      this.cdr.markForCheck();
    }
  }

  async applyCourseForEdit(course: OfflineCourseItem): Promise<void> {
    const isSpecial = this.isSpecialCourseValue(course.isSpecial);
    const instructors = Array.isArray(course.instructors) ? course.instructors : [];

    this.courseForm.patchValue(
      {
        title: course.title || '',
        isSpecial,
        categoryId: course.categoryId ? `${course.categoryId}` : '',
        parentCourseId: '',
        startDate: course.startDate || '',
        endDate: course.endDate || '',
        startTime: course.startTime || '',
        endTime: course.endTime || '',
        youtubeLiveUrl: course.youtubeLiveUrl || '',
        meetingLink: course.meetingLink || '',
        instructors,
        price: Number(course.price) || 0,
        description: course.description || '',
        status: Number(course.publishedFlag ?? course.status) === 1 ? '1' : '0',
      },
      { emitEvent: false },
    );

    const parentControl = this.courseForm.get('parentCourseId');

    if (isSpecial) {
      parentControl?.setValidators([Validators.required]);
      parentControl?.updateValueAndValidity({ emitEvent: false });
      await this.loadParentAcademicCourses();
      this.courseForm.patchValue(
        { parentCourseId: course.parentCourseId ? `${course.parentCourseId}` : '' },
        { emitEvent: false },
      );
    } else {
      parentControl?.clearValidators();
      parentControl?.updateValueAndValidity({ emitEvent: false });
    }

    this.setHighlightsFromCourse(this.getSelectedCourseHighlights(course));
    await this.applyLocationForEdit(course);
    this.selectedBannerImage = null;
    this.setBannerPreviewUrl(course.thumbnailUrl || null);
    this.syncCalendarView('startDate');
    this.syncCalendarView('endDate');
    this.courseForm.markAsPristine();
    this.courseForm.markAsUntouched();
  }

  private async applyLocationForEdit(course: OfflineCourseItem): Promise<void> {
    const stateCode = Number(course.stateCode || 0);
    const districtCode = Number(course.districtCode || 0);
    const branchId = Number(course.branchId || 0);
    const districtControl = this.courseForm.get('districtCode');
    const branchControl = this.courseForm.get('branchId');

    this.districts = [];
    this.branches = [];
    this.selectedStateCode = stateCode ? `${stateCode}` : '';
    this.selectedDistrictCode = districtCode ? `${districtCode}` : '';

    if (!stateCode) {
      this.courseForm.patchValue({ stateCode: '', districtCode: '', branchId: '' }, { emitEvent: false });
      districtControl?.disable();
      branchControl?.disable();
      return;
    }

    this.courseForm.patchValue({ stateCode: `${stateCode}`, districtCode: '', branchId: '' }, { emitEvent: false });
    districtControl?.enable({ emitEvent: false });
    await this.loadDistricts(stateCode);

    if (!districtCode) {
      branchControl?.disable();
      return;
    }

    this.courseForm.patchValue({ districtCode: `${districtCode}`, branchId: '' }, { emitEvent: false });
    branchControl?.enable({ emitEvent: false });
    await this.loadBranches(stateCode, districtCode);

    this.courseForm.patchValue({ branchId: branchId ? `${branchId}` : '' }, { emitEvent: false });
  }

  @HostListener('document:click', ['$event'])
  closeInstructorPickerOnOutsideClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isInstructorPickerOpen = false;
      this.openCalendar = null;
      return;
    }

    this.openCalendar = null;
  }

  toggleInstructorPicker(): void {
    if (this.isInstructorUser) {
      this.isInstructorPickerOpen = false;
      this.openCalendar = null;
      return;
    }

    this.isInstructorPickerOpen = !this.isInstructorPickerOpen;
    this.openCalendar = null;
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
    if (this.isInstructorUser) {
      (event.target as HTMLInputElement).checked = true;
      this.applyInstructorSelectionDefaults();
      return;
    }

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

    if (control.errors['dateInPast']) {
      return `${fieldName} cannot be before today.`;
    }

    if (control.errors['invalidDate']) {
      return `${fieldName} format is invalid.`;
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

  toggleCalendar(controlName: OfflineDateControl, event: Event): void {
    event.stopPropagation();

    if (this.openCalendar !== controlName) {
      this.syncCalendarView(controlName);
    }

    this.openCalendar = this.openCalendar === controlName ? null : controlName;
    this.isInstructorPickerOpen = false;
  }

  keepCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  changeCalendarMonth(controlName: OfflineDateControl, offset: number): void {
    const currentView = this.calendarViews[controlName];
    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: this.clampCalendarView(
        controlName,
        new Date(currentView.getFullYear(), currentView.getMonth() + offset, 1),
      ),
    };
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
    this.cdr.markForCheck();
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
    const categoryId = Number(this.f['categoryId'].value);

    this.parentAcademicCourses = [];
    this.parentCoursesMessage = '';

    if (!this.isSpecialCourse || !Number.isFinite(categoryId) || categoryId <= 0) {
      this.cdr.markForCheck();
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
        (course) => Number(course.categoryId) === categoryId && Number(course.isSpecial ?? 0) !== 1,
      );
      this.parentCoursesMessage = this.parentAcademicCourses.length
        ? ''
        : 'No academic courses found for this category.';
    } catch (error) {
      console.error(error);
      this.parentCoursesMessage = 'Unable to load academic courses.';
    } finally {
      this.isParentCoursesLoading = false;
      this.cdr.markForCheck();
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

  setCalendarMonth(controlName: OfflineDateControl, event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    const currentView = this.calendarViews[controlName];

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: this.clampCalendarView(controlName, new Date(currentView.getFullYear(), month, 1)),
    };
  }

  setCalendarYear(controlName: OfflineDateControl, event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    const currentView = this.calendarViews[controlName];

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: this.clampCalendarView(controlName, new Date(year, currentView.getMonth(), 1)),
    };
  }

  isPreviousMonthDisabled(controlName: OfflineDateControl): boolean {
    const currentView = this.calendarViews[controlName];
    const previousView = new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1);

    return previousView < this.minimumCalendarView(controlName);
  }

  selectCalendarDate(controlName: OfflineDateControl, day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    const control = this.courseForm.get(controlName);
    control?.setValue(day.iso);
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();

    if (controlName === 'startDate') {
      const endDate = `${this.f['endDate'].value || ''}`;
      if (endDate && endDate <= day.iso) {
        this.courseForm.patchValue({ endDate: '' });
      }
      this.syncCalendarView('endDate');
    }

    this.courseForm.updateValueAndValidity();
    this.openCalendar = null;
  }

  clearCalendarDate(controlName: OfflineDateControl, event: Event): void {
    event.stopPropagation();
    const control = this.courseForm.get(controlName);
    control?.setValue('');
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.courseForm.updateValueAndValidity();
    this.syncCalendarView(controlName);
  }

  resetForm(): void {
    if (this.isEditMode && this.editCourseId) {
      void this.loadCourseForEdit(this.editCourseId);
      return;
    }

    this.courseForm.reset({
      title: '',
      isSpecial: this.isInstructorUser,
      categoryId: '',
      parentCourseId: '',
      stateCode: '',
      districtCode: '',
      branchId: '',
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
    this.courseForm.get('parentCourseId')?.clearValidators();
    this.courseForm.get('parentCourseId')?.updateValueAndValidity();
    this.applyInstructorSpecialCourseDefaults();
    this.applyInstructorSelectionDefaults();
    this.parentAcademicCourses = [];
    this.parentCoursesMessage = '';
    this.selectedStateCode = '';
    this.selectedDistrictCode = '';
    this.districts = [];
    this.branches = [];
    this.courseForm.get('districtCode')?.disable();
    this.courseForm.get('branchId')?.disable();
    this.highlights.clear();
    this.addHighlight();
    this.selectedBannerImage = null;
    this.setBannerPreviewUrl(null);
    this.syncCalendarView('startDate');
    this.syncCalendarView('endDate');
  }

  onBannerImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) {
      return;
    }

    if (!this.allowedBannerImageTypes.includes(file.type)) {
      input.value = '';
      void this.alertHelper.error('Please upload a JPG, PNG, or WEBP banner image.');
      return;
    }

    if (file.size > this.maxBannerImageSize) {
      input.value = '';
      void this.alertHelper.error('Banner image cannot exceed 2 MB.');
      return;
    }

    this.selectedBannerImage = file;
    this.setBannerPreviewUrl(URL.createObjectURL(file));
  }

  clearBannerImage(): void {
    this.selectedBannerImage = null;
    this.setBannerPreviewUrl(null);
  }

  async submitCourse(): Promise<void> {
    if (!this.formValidationService.validateForm(this.courseForm, this.getFieldName, this.el)) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      this.isEditMode ? 'Do you want to update this offline course?' : 'Do you want to add this offline course?',
      this.isEditMode ? 'Update Offline Course' : 'Add Offline Course',
    );

    if (!confirmed) {
      return;
    }

    try {
      this.spinner.show();
      const payload = this.getPayload();

      if (this.isEditMode && this.editCourseId) {
        payload.append('id', `${this.editCourseId}`);
      }

      const response: any = await lastValueFrom(
        (this.isEditMode
          ? this.courseService.updateOfflineCourse(payload)
          : this.courseService.createOfflineCourse(payload)
        ).pipe(timeout(20000)),
      );

      if (response.status) {
        const courseCode = response.data?.code ? `\nCode: ${response.data.code}` : '';
        await this.alertHelper.success(
          `${response.message || (this.isEditMode ? 'Offline course updated successfully!' : 'Offline course added successfully!')}${courseCode}`,
        );
        if (!this.isEditMode) {
          this.resetForm();
        }
        void this.router.navigate(['/application/courses/manageOfflineCourses/viewMyOfflineCourses']);
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
      isSpecial: 'Special Course',
      categoryId: 'Category',
      parentCourseId: 'Parent Academic Course',
      stateCode: 'State',
      districtCode: 'District/City',
      branchId: 'Branch',
      startDate: 'Start Date',
      endDate: 'End Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      youtubeLiveUrl: 'YouTube Live URL',
      meetingLink: 'Meeting Link',
      thumbnail: 'Banner Image',
      instructors: 'Instructor',
      price: 'Price',
      description: 'Description',
      highlights: 'Key Outcomes',
      status: 'Status',
    };

    return map[field] || field;
  }

  private getPayload(): FormData {
    const value = this.courseForm.getRawValue();
    const categoryId = Number(value.categoryId);
    const selectedBranch = this.selectedBranch;
    const formData = new FormData();

    formData.append('title', `${value.title}`.trim());
    formData.append('isSpecial', this.isSpecialCourse ? '1' : '0');
    formData.append('parentCourseId', this.isSpecialCourse ? `${Number(value.parentCourseId) || ''}` : '');
    formData.append('category', `${Number.isFinite(categoryId) ? categoryId : ''}`);
    formData.append('instructor', JSON.stringify(this.selectedInstructors.map((instructor) => instructor.id)));
    formData.append('stateCode', `${Number(value.stateCode) || ''}`);
    formData.append('districtCode', `${Number(value.districtCode) || ''}`);
    formData.append('branchId', `${Number(value.branchId) || ''}`);
    formData.append('venue', `${selectedBranch?.branchName || ''}`.trim());
    formData.append('city', `${this.selectedDistrictName || selectedBranch?.districtName || ''}`.trim());
    formData.append('startDate', value.startDate);
    formData.append('endDate', value.endDate || '');
    formData.append('startTime', value.startTime);
    formData.append('endTime', value.endTime || '');
    formData.append('youtubeLiveUrl', this.normalizeOptionalText(value.youtubeLiveUrl) || '');
    formData.append('meetingLink', this.normalizeOptionalText(value.meetingLink) || '');
    formData.append('price', `${Number(value.price) || 0}`);
    formData.append('description', `${value.description}`.trim());
    formData.append('courseHighlights', JSON.stringify(this.getCleanHighlights()));
    formData.append('status', `${Number(value.status) === 0 ? 0 : 1}`);

    if (this.selectedBannerImage) {
      formData.append('thumbnail', this.selectedBannerImage);
    }

    return formData;
  }

  private getCleanHighlights(): string[] {
    return this.highlights.value
      .map((highlight) => `${highlight || ''}`.trim())
      .filter((highlight) => highlight.length > 0);
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
    const nextHighlights = cleanHighlights.length ? cleanHighlights : [''];

    while (this.highlights.length < nextHighlights.length) {
      this.highlights.push(this.fb.control(''));
    }

    while (this.highlights.length > nextHighlights.length) {
      this.highlights.removeAt(this.highlights.length - 1);
    }

    nextHighlights.forEach((highlight, index) => {
      this.highlights.at(index).setValue(highlight);
      this.highlights.at(index).markAsDirty();
      this.highlights.at(index).markAsTouched();
    });

    this.highlights.markAsDirty();
    this.highlights.markAsTouched();
    this.highlights.updateValueAndValidity();
  }

  private normalizeOptionalText(value: unknown): string | null {
    const text = `${value || ''}`.trim();

    return text || null;
  }

  private isSpecialCourseValue(value: unknown): boolean {
    return value === true || Number(value ?? 0) === 1;
  }

  private setBannerPreviewUrl(url: string | null): void {
    if (this.bannerPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.bannerPreviewUrl);
    }

    this.bannerPreviewUrl = url;
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (startDate && endDate && endDate <= startDate) {
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

  private buildCalendarDays(controlName: OfflineDateControl): CalendarDay[] {
    const selectedIso = `${this.f[controlName].value || ''}`;
    const todayIso = this.toIsoDate(new Date());
    const calendarView = this.calendarViews[controlName];
    const firstOfMonth = new Date(calendarView.getFullYear(), calendarView.getMonth(), 1);
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const iso = this.toIsoDate(date);

      return {
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === calendarView.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: this.isCalendarDayDisabled(controlName, iso),
      };
    });
  }

  private isCalendarDayDisabled(controlName: OfflineDateControl, iso: string): boolean {
    return iso < this.minimumSelectableIso(controlName);
  }

  private syncCalendarView(controlName: OfflineDateControl): void {
    const selectedDate = this.parseIsoDate(`${this.f[controlName].value || ''}`);
    const fallbackDate =
      controlName === 'endDate'
        ? this.parseIsoDate(`${this.f['startDate'].value || ''}`)
        : null;

    const nextView = selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : fallbackDate
        ? new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1)
        : this.defaultCalendarView();

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: this.clampCalendarView(controlName, nextView),
    };
  }

  private defaultCalendarView(): Date {
    const today = new Date();

    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  private buildCalendarYearOptions(): number[] {
    return Array.from({ length: 8 }, (_, index) => this.currentYear + index);
  }

  private clampCalendarView(controlName: OfflineDateControl, value: Date): Date {
    const nextView = new Date(value.getFullYear(), value.getMonth(), 1);
    const minimumView = this.minimumCalendarView(controlName);

    return nextView < minimumView ? minimumView : nextView;
  }

  private minimumCalendarView(controlName: OfflineDateControl): Date {
    const minimumDate = this.parseIsoDate(this.minimumSelectableIso(controlName)) || new Date();

    return new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
  }

  private minimumSelectableIso(controlName: OfflineDateControl): string {
    let minimumIso = this.todayIso();

    if (controlName === 'endDate') {
      const startDate = this.parseIsoDate(`${this.f['startDate'].value || ''}`);

      if (startDate) {
        const minimumEndDate = new Date(startDate);
        minimumEndDate.setDate(startDate.getDate() + 1);
        const minimumEndIso = this.toIsoDate(minimumEndDate);

        if (minimumEndIso > minimumIso) {
          minimumIso = minimumEndIso;
        }
      }
    }

    return minimumIso;
  }

  private todayIso(): string {
    return this.toIsoDate(new Date());
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const isSameDate =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

    return isSameDate ? date : null;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatIsoDateForDisplay(value: string): string {
    const date = this.parseIsoDate(value);

    if (!date) {
      return '';
    }

    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');

    return `${day}-${month}-${date.getFullYear()}`;
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

    return (
      apiError?.message ||
      `Unable to ${this.isEditMode ? 'update' : 'add'} offline course. Please try again.`
    );
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

    this.courseForm.patchValue({ instructors: [instructor] }, { emitEvent: false });
    this.f['instructors'].updateValueAndValidity({ emitEvent: false });
    this.isInstructorPickerOpen = false;
    this.instructorSearchTerm = '';
  }

  private getLoggedInInstructorOption(): OfflineCourseInstructor | null {
    const userId = Number(this.getStoredUser()?.id);
    const matchingInstructor = Number.isFinite(userId)
      ? this.instructorList.find((instructor) => Number(instructor.id) === userId)
      : null;

    return matchingInstructor || this.instructorList[0] || null;
  }

  private getInstructorCode(instructor: OfflineCourseInstructor): string {
    return `${instructor?.code ?? instructor?.instructorCode ?? instructor?.instructor_code ?? ''}`.trim();
  }
}
