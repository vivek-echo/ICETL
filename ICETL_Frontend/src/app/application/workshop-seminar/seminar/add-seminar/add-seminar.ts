import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
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
import { SeminarItem, SeminarPayload, SeminarService } from '../../services/seminar';

interface CalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-add-seminar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-seminar.html',
  styleUrl: './add-seminar.scss',
})
export class AddSeminar implements OnInit {
  readonly viewRoute = '/application/workshopSeminar/seminar/view';
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
  isEventCalendarOpen = false;
  eventCalendarView = this.defaultCalendarView();
  selectedBannerImage: File | null = null;
  bannerPreviewUrl: string | null = null;
  private readonly maxBannerImageSize = 4 * 1024 * 1024;
  private readonly allowedBannerImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private existingBannerImageUrl: string | null = null;
  private seminarId: number | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly seminarService: SeminarService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly formValidationService: FormValidationService,
    private readonly alertHelper: AlertHelperService,
    private readonly el: ElementRef,
  ) {
    this.itemForm = this.fb.group(
      {
        title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
        topic: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
        venue: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
        city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
        eventDate: ['', Validators.required],
        startTime: ['', Validators.required],
        endTime: [''],
        speakerName: ['', FormValidationRules.requiredName()],
        capacity: [100, [Validators.required, Validators.min(1)]],
        price: [0, [Validators.required, Validators.min(0)]],
        description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
        takeaways: this.fb.array([this.fb.control('')]),
        status: ['1', Validators.required],
      },
      {
        validators: [this.timeRangeValidator],
      },
    );
  }

  ngOnInit(): void {
    const routeSeminarId = Number(this.route.snapshot.paramMap.get('id'));

    if (Number.isFinite(routeSeminarId) && routeSeminarId > 0) {
      this.seminarId = routeSeminarId;
      void this.loadSeminar();
    }
  }

  get isEditMode(): boolean {
    return this.seminarId !== null;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Seminar' : 'Add Seminar';
  }

  get submitLabel(): string {
    return this.isEditMode ? 'Update Seminar' : 'Save Seminar';
  }

  get f() {
    return this.itemForm.controls;
  }

  get takeaways(): FormArray<FormControl<string | null>> {
    return this.itemForm.get('takeaways') as FormArray<FormControl<string | null>>;
  }

  get scheduleLabel(): string {
    const eventDate = this.f['eventDate'].value;
    const startTime = this.f['startTime'].value;
    const endTime = this.f['endTime'].value;

    if (!eventDate) {
      return 'Date and time';
    }

    const time = startTime ? `${startTime}${endTime ? ` - ${endTime}` : ''}` : 'Time';

    return `${this.formatDate(eventDate)} - ${time}`;
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

  get eventDateDisplayValue(): string {
    return this.formatIsoDateForDisplay(`${this.f['eventDate'].value || ''}`);
  }

  get eventCalendarDays(): CalendarDay[] {
    const selectedIso = `${this.f['eventDate'].value || ''}`;
    const todayIso = this.toIsoDate(new Date());
    const firstOfMonth = new Date(
      this.eventCalendarView.getFullYear(),
      this.eventCalendarView.getMonth(),
      1,
    );
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const iso = this.toIsoDate(date);

      return {
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === this.eventCalendarView.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: false,
      };
    });
  }

  @HostListener('document:click')
  closeEventCalendar(): void {
    this.isEventCalendarOpen = false;
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

    if (control.errors['nameOnly']) {
      return `${fieldName} can contain only letters and spaces.`;
    }

    return `${fieldName} is invalid.`;
  }

  hasTimeRangeError(): boolean {
    return (
      this.itemForm.hasError('timeRange') &&
      (this.f['endTime'].dirty || this.f['endTime'].touched)
    );
  }

  toggleEventCalendar(event: Event): void {
    event.stopPropagation();

    if (!this.isEventCalendarOpen) {
      this.syncEventCalendarView();
    }

    this.isEventCalendarOpen = !this.isEventCalendarOpen;
  }

  keepEventCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  changeEventCalendarMonth(offset: number): void {
    this.eventCalendarView = new Date(
      this.eventCalendarView.getFullYear(),
      this.eventCalendarView.getMonth() + offset,
      1,
    );
  }

  setEventCalendarMonth(event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    this.eventCalendarView = new Date(this.eventCalendarView.getFullYear(), month, 1);
  }

  setEventCalendarYear(event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    this.eventCalendarView = new Date(year, this.eventCalendarView.getMonth(), 1);
  }

  selectEventDate(day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    const control = this.itemForm.get('eventDate');
    control?.setValue(day.iso);
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.isEventCalendarOpen = false;
  }

  clearEventDate(event: Event): void {
    event.stopPropagation();
    const control = this.itemForm.get('eventDate');
    control?.setValue('');
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.syncEventCalendarView();
  }

  resetForm(): void {
    if (this.isEditMode) {
      void this.loadSeminar();
      this.formMessage = '';
      return;
    }

    this.itemForm.reset({
      title: '',
      topic: '',
      venue: '',
      city: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      speakerName: '',
      capacity: 100,
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

  async saveSeminar(): Promise<void> {
    this.formMessage = '';

    if (!this.formValidationService.validateForm(this.itemForm, this.getFieldName, this.el)) {
      this.formMessage = this.getTimeValidationMessage() || 'Please complete the required seminar details.';
      return;
    }

    const timeValidationMessage = this.getTimeValidationMessage();

    if (timeValidationMessage) {
      this.formMessage = timeValidationMessage;
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Do you want to ${this.isEditMode ? 'update' : 'add'} this seminar?`,
      this.pageTitle,
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;

    try {
      const payload = this.getPayload();
      const requestPayload = this.toFormData(payload, this.seminarId);
      const request$ = this.isEditMode && this.seminarId
        ? this.seminarService.updateSeminar(requestPayload)
        : this.seminarService.createSeminar(requestPayload);
      const response = await lastValueFrom(request$.pipe(timeout(20000)));

      if (response.status) {
        const seminarCode = response.data?.code ? `\nCode: ${response.data.code}` : '';
        await this.alertHelper.success(`${response.message || 'Seminar saved successfully.'}${seminarCode}`);

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

  private async loadSeminar(): Promise<void> {
    if (!this.seminarId) {
      return;
    }

    this.loading = true;

    try {
      const response = await lastValueFrom(
        this.seminarService.getSeminarById({ id: this.seminarId }).pipe(timeout(15000)),
      );

      if (response.status && response.data) {
        this.patchSeminarForm(response.data);
      } else {
        await this.alertHelper.error(response.message || 'Unable to load seminar.');
        void this.router.navigate([this.viewRoute]);
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error));
      void this.router.navigate([this.viewRoute]);
    } finally {
      this.loading = false;
    }
  }

  private patchSeminarForm(seminar: SeminarItem): void {
    this.itemForm.patchValue({
      title: seminar.title,
      topic: seminar.topic,
      venue: seminar.venue,
      city: seminar.city,
      eventDate: seminar.eventDate,
      startTime: seminar.startTime,
      endTime: seminar.endTime || '',
      speakerName: seminar.speakerName,
      capacity: seminar.capacity,
      price: seminar.price,
      description: seminar.description,
      status: `${seminar.status}`,
    });

    this.selectedBannerImage = null;
    this.existingBannerImageUrl = seminar.bannerImageUrl || null;
    this.setBannerPreviewUrl(this.existingBannerImageUrl);
    this.takeaways.clear();
    const takeaways = seminar.takeaways.length ? seminar.takeaways : [''];
    takeaways.forEach((takeaway) => this.takeaways.push(this.fb.control(takeaway)));
    this.syncEventCalendarView();
  }

  private getPayload(): SeminarPayload {
    const value = this.itemForm.value;

    return {
      title: `${value.title}`.trim(),
      topic: `${value.topic}`.trim(),
      venue: `${value.venue}`.trim(),
      city: `${value.city}`.trim(),
      eventDate: value.eventDate,
      startDate: value.eventDate,
      endDate: null,
      startTime: value.startTime,
      endTime: this.normalizeOptionalText(value.endTime),
      speakerName: `${value.speakerName}`.trim(),
      capacity: Number(value.capacity) || 0,
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

  private toFormData(payload: SeminarPayload, id?: number | null): FormData {
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

  private getTimeValidationMessage(): string {
    const startTime = this.f['startTime'].value;
    const endTime = this.f['endTime'].value;

    if (startTime && endTime && endTime <= startTime) {
      return 'End time must be later than start time.';
    }

    return '';
  }

  private getFieldName(field: string): string {
    const map: Record<string, string> = {
      title: 'Seminar Title',
      topic: 'Topic',
      venue: 'Venue',
      city: 'City',
      eventDate: 'Event Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      speakerName: 'Speaker',
      capacity: 'Capacity',
      price: 'Fee',
      description: 'Description',
      bannerImage: 'Banner Image',
      status: 'Status',
    };

    return map[field] || field;
  }

  private timeRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startTime = control.get('startTime')?.value;
    const endTime = control.get('endTime')?.value;

    if (startTime && endTime && endTime <= startTime) {
      return { timeRange: true };
    }

    return null;
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  private syncEventCalendarView(): void {
    const selectedDate = this.parseIsoDate(`${this.f['eventDate'].value || ''}`);
    this.eventCalendarView = selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : this.defaultCalendarView();
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

    return apiError?.message || 'Unable to save seminar. Please try again.';
  }
}
