import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { FormValidationRules } from '../../../../commonServices/form-validation-rules';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { WorkshopItem, WorkshopPayload, WorkshopService } from '../../services/workshop';

type WorkshopDateControl = 'startDate' | 'endDate';

interface CalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-add-workshop',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-workshop.html',
  styleUrl: './add-workshop.scss',
})
export class AddWorkshop implements OnInit {
  readonly viewRoute = '/application/workshopSeminar/workshop/viewMyWorkshop';
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
  formMessage = '';
  itemForm: FormGroup;
  loading = false;
  saving = false;
  openCalendar: WorkshopDateControl | null = null;
  calendarViews: Record<WorkshopDateControl, Date> = {
    startDate: this.defaultCalendarView(),
    endDate: this.defaultCalendarView(),
  };
  selectedBannerImage: File | null = null;
  bannerPreviewUrl: string | null = null;
  @Input() modalMode = false;
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  private readonly maxBannerImageSize = 4 * 1024 * 1024;
  private readonly allowedBannerImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private existingBannerImageUrl: string | null = null;
  private inputEditMode = false;
  private workshopId: number | null = null;

  @Input() set editWorkshop(value: WorkshopItem | null | undefined) {
    if (!value?.id) {
      return;
    }

    this.inputEditMode = true;
    this.workshopId = value.id;
    this.loading = false;
    this.patchWorkshopForm(value);
    this.cdr.markForCheck();
  }

  @Input() set editWorkshopId(value: number | null | undefined) {
    const nextId = Number(value);

    if (Number.isFinite(nextId) && nextId > 0 && nextId !== this.workshopId) {
      this.inputEditMode = true;
      this.workshopId = nextId;
      void this.loadWorkshop();
    }
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly workshopService: WorkshopService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly formValidationService: FormValidationService,
    private readonly alertHelper: AlertHelperService,
    private readonly el: ElementRef,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.itemForm = this.fb.group(
      {
        title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(48)]],
        topic: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(48)]],
        venue: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(48)]],
        city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(48)]],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        startTime: ['', Validators.required],
        endTime: [''],
        speakerName: ['', FormValidationRules.requiredName()],
        price: [0, [Validators.required, Validators.min(0)]],
        description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
        takeaways: this.fb.array([this.fb.control('')]),
        status: ['1', Validators.required],
      },
      {
        validators: [this.dateRangeValidator, this.timeRangeValidator],
      },
    );
  }

  ngOnInit(): void {
    const routeWorkshopId = Number(this.route.snapshot.paramMap.get('id'));

    if (Number.isFinite(routeWorkshopId) && routeWorkshopId > 0) {
      this.workshopId = routeWorkshopId;
      void this.loadWorkshop();
    }
  }

  get isEditMode(): boolean {
    return this.workshopId !== null;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Workshop' : 'Add Workshop';
  }

  get submitLabel(): string {
    return this.isEditMode ? 'Update Workshop' : 'Save Workshop';
  }

  get f() {
    return this.itemForm.controls;
  }

  get takeaways(): FormArray<FormControl<string | null>> {
    return this.itemForm.get('takeaways') as FormArray<FormControl<string | null>>;
  }

  get dateRangeLabel(): string {
    const startDate = this.f['startDate'].value;
    const endDate = this.f['endDate'].value;

    if (!startDate) {
      return 'Date range';
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

    if (!Number.isFinite(price) || price === 0) {
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

  @HostListener('document:click')
  closeCalendar(): void {
    this.openCalendar = null;
  }

  addTakeaway(): void {
    this.takeaways.push(this.fb.control(''));
  }

  removeTakeaway(index: number): void {
    if (this.takeaways.length <= 1) {
      this.takeaways.at(0).setValue('');
      return;
    }

    this.takeaways.removeAt(index);
  }

  isInvalid(controlName: string): boolean {
    const control = this.itemForm.get(controlName);

    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getFieldError(controlName: string): string {
    const control = this.itemForm.get(controlName);

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

    return `${fieldName} is invalid.`;
  }

  hasDateRangeError(): boolean {
    return (
      this.itemForm.hasError('dateRange') &&
      (this.f['endDate'].dirty || this.f['endDate'].touched)
    );
  }

  hasTimeRangeError(): boolean {
    return (
      this.itemForm.hasError('timeRange') &&
      (this.f['endTime'].dirty || this.f['endTime'].touched)
    );
  }

  toggleCalendar(controlName: WorkshopDateControl, event: Event): void {
    event.stopPropagation();

    if (this.openCalendar !== controlName) {
      this.syncCalendarView(controlName);
    }

    this.openCalendar = this.openCalendar === controlName ? null : controlName;
  }

  keepCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  changeCalendarMonth(controlName: WorkshopDateControl, offset: number): void {
    const currentView = this.calendarViews[controlName];
    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: new Date(currentView.getFullYear(), currentView.getMonth() + offset, 1),
    };
  }

  setCalendarMonth(controlName: WorkshopDateControl, event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    const currentView = this.calendarViews[controlName];

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: new Date(currentView.getFullYear(), month, 1),
    };
  }

  setCalendarYear(controlName: WorkshopDateControl, event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    const currentView = this.calendarViews[controlName];

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: new Date(year, currentView.getMonth(), 1),
    };
  }

  selectCalendarDate(controlName: WorkshopDateControl, day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    const control = this.itemForm.get(controlName);
    control?.setValue(day.iso);
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();

    if (controlName === 'startDate') {
      const endDate = `${this.f['endDate'].value || ''}`;
      if (endDate && new Date(endDate) < new Date(day.iso)) {
        this.itemForm.patchValue({ endDate: '' });
      }
    }

    this.itemForm.updateValueAndValidity();
    this.openCalendar = null;
  }

  clearCalendarDate(controlName: WorkshopDateControl, event: Event): void {
    event.stopPropagation();
    const control = this.itemForm.get(controlName);
    control?.setValue('');
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.itemForm.updateValueAndValidity();
    this.syncCalendarView(controlName);
  }

  resetForm(): void {
    if (this.isEditMode) {
      void this.loadWorkshop();
      this.formMessage = '';
      return;
    }

    this.itemForm.reset({
      title: '',
      topic: '',
      venue: '',
      city: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      speakerName: '',
      price: 0,
      description: '',
      status: '1',
    });
    this.takeaways.clear();
    this.addTakeaway();
    this.selectedBannerImage = null;
    this.existingBannerImageUrl = null;
    this.setBannerPreviewUrl(null);
    this.formMessage = '';
  }

  closeModal(): void {
    if (this.modalMode) {
      this.closed.emit();
    }
  }

  onBannerImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) {
      return;
    }

    if (!this.allowedBannerImageTypes.includes(file.type)) {
      input.value = '';
      this.formMessage = 'Please upload a JPG, PNG, or WEBP banner image.';
      return;
    }

    if (file.size > this.maxBannerImageSize) {
      input.value = '';
      this.formMessage = 'Banner image cannot exceed 4 MB.';
      return;
    }

    this.selectedBannerImage = file;
    this.formMessage = '';
    this.setBannerPreviewUrl(URL.createObjectURL(file));
  }

  clearSelectedBannerImage(): void {
    this.selectedBannerImage = null;
    this.setBannerPreviewUrl(this.existingBannerImageUrl);
  }

  async saveWorkshop(): Promise<void> {
    this.formMessage = '';

    if (!this.formValidationService.validateForm(this.itemForm, this.getFieldName, this.el)) {
      this.formMessage = this.getDateValidationMessage() || 'Please complete the required workshop details.';
      return;
    }

    const dateValidationMessage = this.getDateValidationMessage();

    if (dateValidationMessage) {
      this.formMessage = dateValidationMessage;
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Do you want to ${this.isEditMode ? 'update' : 'add'} this workshop?`,
      this.pageTitle,
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;

    try {
      const payload = this.getPayload();
      const requestPayload = this.toFormData(payload, this.workshopId);
      const request$ = this.isEditMode && this.workshopId
        ? this.workshopService.updateWorkshop(requestPayload)
        : this.workshopService.createWorkshop(requestPayload);
      const response = await lastValueFrom(request$.pipe(timeout(20000)));

      if (response.status) {
        const workshopCode = response.data?.code ? `\nCode: ${response.data.code}` : '';
        await this.alertHelper.success(`${response.message || 'Workshop saved successfully.'}${workshopCode}`);

        if (this.modalMode) {
          this.saved.emit();
          return;
        }

        if (!this.isEditMode) {
          this.resetForm();
        }

        void this.router.navigate([this.viewRoute]);
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
    } finally {
      this.saving = false;
    }
  }

  private async loadWorkshop(): Promise<void> {
    if (!this.workshopId) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.workshopService.getWorkshopById({ id: this.workshopId }).pipe(timeout(15000)),
      );

      if (response.status && response.data) {
        this.patchWorkshopForm(response.data);
      } else {
        await this.alertHelper.error(response.message || 'Unable to load workshop.');
        this.handleLoadFailure();
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
      this.handleLoadFailure();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private handleLoadFailure(): void {
    if (this.modalMode || this.inputEditMode) {
      this.closed.emit();
      return;
    }

    void this.router.navigate([this.viewRoute]);
  }

  private patchWorkshopForm(workshop: WorkshopItem): void {
    this.itemForm.patchValue({
      title: workshop.title,
      topic: workshop.topic,
      venue: workshop.venue,
      city: workshop.city,
      startDate: workshop.startDate,
      endDate: workshop.endDate || workshop.startDate,
      startTime: workshop.startTime,
      endTime: workshop.endTime || '',
      speakerName: workshop.speakerName,
      price: workshop.price,
      description: workshop.description,
      status: `${workshop.status}`,
    });

    this.selectedBannerImage = null;
    this.existingBannerImageUrl = workshop.bannerImageUrl || null;
    this.setBannerPreviewUrl(this.existingBannerImageUrl);
    this.takeaways.clear();
    const workshopTakeaways = Array.isArray(workshop.takeaways) ? workshop.takeaways : [];
    const takeaways = workshopTakeaways.length ? workshopTakeaways : [''];
    takeaways.forEach((takeaway) => this.takeaways.push(this.fb.control(takeaway)));
    this.syncCalendarView('startDate');
    this.syncCalendarView('endDate');
  }

  private getPayload(): WorkshopPayload {
    const value = this.itemForm.value;

    return {
      title: `${value.title}`.trim(),
      topic: `${value.topic}`.trim(),
      venue: `${value.venue}`.trim(),
      city: `${value.city}`.trim(),
      eventDate: value.startDate,
      startDate: value.startDate,
      endDate: value.endDate,
      startTime: value.startTime,
      endTime: this.normalizeOptionalText(value.endTime),
      speakerName: `${value.speakerName}`.trim(),
      capacity: 0,
      price: Number(value.price) || 0,
      description: `${value.description}`.trim(),
      takeaways: this.getCleanTakeaways(),
      status: Number(value.status) === 0 ? 0 : 1,
    };
  }

  private getCleanTakeaways(): string[] {
    return this.takeaways.value
      .map((takeaway) => `${takeaway || ''}`.trim())
      .filter((takeaway) => takeaway.length > 0);
  }

  private normalizeOptionalText(value: unknown): string | null {
    const text = `${value || ''}`.trim();

    return text || null;
  }

  private toFormData(payload: WorkshopPayload, id?: number | null): FormData {
    const formData = new FormData();

    if (id) {
      formData.append('id', `${id}`);
    }

    formData.append('title', payload.title);
    formData.append('topic', payload.topic);
    formData.append('venue', payload.venue);
    formData.append('city', payload.city);
    formData.append('eventDate', payload.eventDate);
    formData.append('startDate', payload.startDate);
    formData.append('endDate', payload.endDate || '');
    formData.append('startTime', payload.startTime);
    formData.append('endTime', payload.endTime || '');
    formData.append('speakerName', payload.speakerName);
    formData.append('capacity', `${payload.capacity}`);
    formData.append('price', `${payload.price}`);
    formData.append('description', payload.description);
    formData.append('takeaways', JSON.stringify(payload.takeaways));
    formData.append('status', `${payload.status}`);

    if (this.selectedBannerImage) {
      formData.append('bannerImage', this.selectedBannerImage);
    }

    return formData;
  }

  private setBannerPreviewUrl(url: string | null): void {
    if (this.bannerPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.bannerPreviewUrl);
    }

    this.bannerPreviewUrl = url;
  }

  private getDateValidationMessage(): string {
    if (this.itemForm.hasError('dateRange')) {
      this.f['endDate'].markAsTouched();
      return 'End date cannot be earlier than start date.';
    }

    if (this.itemForm.hasError('timeRange')) {
      this.f['endTime'].markAsTouched();
      return 'End time must be later than start time for a same-day workshop.';
    }

    return '';
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

  private getFieldName(field: string): string {
    const map: Record<string, string> = {
      title: 'Workshop Title',
      topic: 'Topic',
      venue: 'Venue',
      city: 'City',
      startDate: 'Start Date',
      endDate: 'End Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      speakerName: 'Speaker',
      price: 'Fee',
      description: 'Description',
      bannerImage: 'Banner Image',
      status: 'Status',
    };

    return map[field] || field;
  }

  private buildCalendarDays(controlName: WorkshopDateControl): CalendarDay[] {
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

  private isCalendarDayDisabled(controlName: WorkshopDateControl, iso: string): boolean {
    const startDate = `${this.f['startDate'].value || ''}`;

    return controlName === 'endDate' && !!startDate && new Date(iso) < new Date(startDate);
  }

  private syncCalendarView(controlName: WorkshopDateControl): void {
    const selectedDate = this.parseIsoDate(`${this.f[controlName].value || ''}`);
    const fallbackDate =
      controlName === 'endDate'
        ? this.parseIsoDate(`${this.f['startDate'].value || ''}`)
        : null;

    this.calendarViews = {
      ...this.calendarViews,
      [controlName]: selectedDate
        ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        : fallbackDate
          ? new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1)
          : this.defaultCalendarView(),
    };
  }

  private defaultCalendarView(): Date {
    const today = new Date();

    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  private buildCalendarYearOptions(): number[] {
    return Array.from({ length: 8 }, (_, index) => this.currentYear - 1 + index);
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

  private extractErrorMessage(error: any): string {
    const apiError = error?.error;

    if (apiError?.errors && typeof apiError.errors === 'object') {
      const firstFieldErrors = Object.values(apiError.errors)[0];

      if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
        return `${firstFieldErrors[0]}`;
      }
    }

    return apiError?.message || 'Unable to save workshop. Please try again.';
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
}
