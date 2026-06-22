import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AuthService,
  LoginData,
  RoleSelectionOption,
  SendOtpResponse,
  VerifyOtpResponse,
} from '../../../commonServices/auth.service';
import { NavigationService } from '../../../commonServices/nav-item-service';
import { SpinnerService } from '../../../commonServices/spinner/spinner.service';
import { UserProfileService } from '../../../commonServices/user-profile.service';
import { FormValidationService } from '../../../commonServices/form-validation-service';
import { FormValidationRules } from '../../../commonServices/form-validation-rules';

type LoginStep = 'identify' | 'otp' | 'role' | 'profile';

interface CalendarDay {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnDestroy {
  loginForm: FormGroup;
  profileForm: FormGroup;
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
  readonly dobYearOptions = this.buildDobYearOptions();
  readonly genderOptions = [
    { label: 'Male', value: '1' },
    { label: 'Female', value: '2' },
    { label: 'Others', value: '3' },
  ];
  submitted = false;
  isLoading = false;
  errorMessage = '';
  currentStep: LoginStep = 'identify';
  availableRoles: RoleSelectionOption[] = [];
  selectedRoleUserId: number | null = null;
  private flowToken: string | null = null;
  isDobCalendarOpen = false;
  dobCalendarView = this.defaultDobCalendarView();
  otpArray = [0, 1, 2, 3, 4, 5];
  otpValues: string[] = ['', '', '', '', '', ''];

  timer = 60;
  interval: ReturnType<typeof setInterval> | undefined;

  @ViewChildren('otpBox') otpInputs!: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private NavigationService: NavigationService,
    private spinner: SpinnerService,
    private userProfileService: UserProfileService,
    private formValidationService: FormValidationService,
    private el: ElementRef,
  ) {
    if (environment.production === false) {
      this.loginForm = this.fb.group({
        emailId: ['', [Validators.required, Validators.email]],
      });
    } else {
      this.loginForm = this.fb.group({
        emailId: ['', [Validators.required, Validators.email]],
      });
    }

    this.profileForm = this.fb.group({
      name: ['', FormValidationRules.requiredName()],
      phone: ['', FormValidationRules.requiredMobile()],
      dob: ['', [Validators.required, this.dobBeforeTodayValidator()]],
      gender: ['', [Validators.required, Validators.pattern(/^[123]$/)]],
    });
  }

  @HostListener('document:click')
  closeDobCalendar(): void {
    this.isDobCalendarOpen = false;
  }

  get stepTitle(): string {
    switch (this.currentStep) {
      case 'otp':
        return 'Verify OTP';
      case 'role':
        return 'Choose Your Role';
      case 'profile':
        return 'Complete Your Profile';
      default:
        return 'Login';
    }
  }

  get stepDescription(): string {
    switch (this.currentStep) {
      case 'otp':
        return `Enter the 6-digit code sent to ${this.loginForm.value.emailId}.`;
      case 'role':
        return 'Multiple accounts were found for this email. Select the role you want to continue with.';
      case 'profile':
        return 'Your OTP is verified. Add the remaining details to finish creating the account.';
      default:
        return 'Use your email ID to receive a one-time password and continue.';
    }
  }

  get stepLabel(): string {
    switch (this.currentStep) {
      case 'otp':
        return 'Step 2 of 3';
      case 'role':
        return 'Step 3 of 4';
      case 'profile':
        return 'Step 3 of 3';
      default:
        return 'Step 1 of 3';
    }
  }

  get dobDisplayValue(): string {
    return this.formatIsoDateForDisplay(`${this.profileForm.get('dob')?.value ?? ''}`);
  }

  get dobCalendarDays(): CalendarDay[] {
    const selectedIso = `${this.profileForm.get('dob')?.value ?? ''}`;
    const todayIso = this.toIsoDate(new Date());
    const firstOfMonth = new Date(
      this.dobCalendarView.getFullYear(),
      this.dobCalendarView.getMonth(),
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
        isCurrentMonth: date.getMonth() === this.dobCalendarView.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: iso >= todayIso,
      };
    });
  }

  toggleDobCalendar(event: Event): void {
    event.stopPropagation();
    if (!this.isDobCalendarOpen) {
      this.syncDobCalendarView();
    }
    this.isDobCalendarOpen = !this.isDobCalendarOpen;
  }

  keepDobCalendarOpen(event: Event): void {
    event.stopPropagation();
  }

  changeDobCalendarMonth(offset: number): void {
    this.dobCalendarView = new Date(
      this.dobCalendarView.getFullYear(),
      this.dobCalendarView.getMonth() + offset,
      1,
    );
  }

  setDobCalendarMonth(event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    this.dobCalendarView = new Date(this.dobCalendarView.getFullYear(), month, 1);
  }

  setDobCalendarYear(event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    this.dobCalendarView = new Date(year, this.dobCalendarView.getMonth(), 1);
  }

  selectDobDate(day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }

    this.setDobValue(day.iso);
    this.isDobCalendarOpen = false;
  }

  clearDobDate(event: Event): void {
    event.stopPropagation();
    this.setDobValue('');
    this.syncDobCalendarView();
  }

  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  sanitizeNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^A-Za-z ]+/g, '').slice(0, 50);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.profileForm.get('name')?.setValue(sanitized);
  }

  trimNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const trimmed = input.value.trim();

    if (input.value !== trimmed) {
      input.value = trimmed;
    }

    this.profileForm.get('name')?.setValue(trimmed);
  }

  sanitizePhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '').slice(0, 10);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.profileForm.get('phone')?.setValue(sanitized);
  }

  async sendOtp(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.submitted = true;

    if (!this.formValidationService.validateForm(this.loginForm, this.getFieldName, this.el)) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.resetOtpValues();
    this.resetRoleSelection();
    this.profileForm.reset({
      name: '',
      phone: '',
      dob: '',
      gender: '',
    });
    this.isDobCalendarOpen = false;

    try {
      const response = await lastValueFrom(
        this.authService.sendOtp(this.loginForm.value.emailId).pipe(
          finalize(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }),
        ),
      );

      if (!this.isSuccessfulResponse(response)) {
        this.errorMessage = response.message || 'Failed to send OTP';
        return;
      }

      this.currentStep = 'otp';
      this.applyOtpFromResponse(response);
      this.startTimer(response.resendAfter ?? 60);
      this.cdr.detectChanges();

      setTimeout(() => {
        const focusIndex = this.getFirstEmptyOtpIndex();
        if (focusIndex >= 0) {
          this.focusInput(focusIndex);
        }
      }, 0);
    } catch (error) {
      this.errorMessage = this.getApiErrorMessage(error, 'Failed to send OTP');
    }
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();

    if (!/^[0-9]$/.test(value)) {
      input.value = '';
      this.otpValues[index] = '';
      return;
    }

    this.otpValues[index] = value;

    if (index < this.otpArray.length - 1) {
      this.focusInput(index + 1);
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.focusInput(index - 1);
    }
  }

  focusInput(index: number): void {
    const inputs = this.otpInputs.toArray();
    inputs[index]?.nativeElement.focus();
  }

  getOtp(): string {
    return this.otpValues.join('');
  }

  startTimer(seconds = 60): void {
    this.stopTimer(false);
    this.timer = Math.max(seconds, 0);

    this.interval = setInterval(() => {
      this.timer--;

      if (this.timer === 0) {
        this.stopTimer(false);
      }

      this.cdr.detectChanges();
    }, 1000);
  }

  resendOtp(): void {
    if (this.isLoading || this.timer > 0) {
      return;
    }

    void this.sendOtp();
  }

  backToUserInput(): void {
    this.stopTimer();
    this.resetOtpValues();
    this.profileForm.reset({
      name: '',
      phone: '',
      dob: '',
      gender: '',
    });
    this.resetRoleSelection();
    this.isDobCalendarOpen = false;
    this.errorMessage = '';
    this.isLoading = false;
    this.submitted = false;
    this.currentStep = 'identify';
    this.cdr.detectChanges();
  }

  onOtpSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.verifyOtp();
  }

  verifyOtp(): void {
    if (this.isLoading) {
      return;
    }

    const otp = this.getOtp();

    if (otp.length !== this.otpArray.length) {
      this.errorMessage = 'Enter a valid 6 digit OTP';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService
      .verifyOtp({
        emailId: this.loginForm.value.emailId,
        otp,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response: VerifyOtpResponse<LoginData>) => {
          if (
            this.isSuccessfulResponse(response) &&
            (response.requiresProfileCompletion || response.is_new_user)
          ) {
            if (!response.flowToken) {
              this.errorMessage = 'Your login session has expired. Please request a new OTP.';
              return;
            }

            this.stopTimer();
            this.resetOtpValues();
            this.resetRoleSelection();
            this.flowToken = response.flowToken;
            this.currentStep = 'profile';
            this.errorMessage = '';
            return;
          }

          if (
            this.isSuccessfulResponse(response) &&
            (response.requiresRoleSelection || response.is_multi_role_user) &&
            Array.isArray(response.roles) &&
            response.roles.length > 0
          ) {
            if (!response.flowToken) {
              this.errorMessage = 'Your login session has expired. Please request a new OTP.';
              return;
            }

            this.stopTimer();
            this.resetOtpValues();
            this.flowToken = response.flowToken;
            this.availableRoles = response.roles;
            this.selectedRoleUserId = response.roles[0]?.user_id ?? null;
            this.currentStep = 'role';
            this.errorMessage = '';
            return;
          }

          if (this.isSuccessfulResponse(response) && response.data) {
            this.stopTimer();
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Login failed';
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Login failed');
        },
      });
  }

  selectRole(role: RoleSelectionOption): void {
    if (this.isLoading) {
      return;
    }

    if (!role?.user_id) {
      this.errorMessage = 'Please select a valid role';
      return;
    }

    if (!this.flowToken) {
      this.errorMessage = 'Your login session has expired. Please request a new OTP.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.selectedRoleUserId = role.user_id;

    this.authService
      .selectRole({
        flowToken: this.flowToken,
        user_id: role.user_id,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          if (this.isSuccessfulResponse(response) && response.data) {
            this.clearFlowToken();
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Role selection failed';
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Role selection failed');
        },
      });
  }

  completeProfile(): void {
    if (this.isLoading) {
      return;
    }

    if (!this.flowToken) {
      this.errorMessage = 'Your login session has expired. Please request a new OTP.';
      return;
    }

    this.prepareProfileFormForSubmit();

    if (!this.formValidationService.validateForm(this.profileForm, this.getFieldName, this.el)) {
      return;
    }

    const dob = this.normalizeDob(this.profileForm.value.dob);

    if (!dob) {
      this.errorMessage = 'Please select a valid date of birth';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService
      .completeProfile({
        flowToken: this.flowToken,
        ...this.profileForm.value,
        dob,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          if (this.isSuccessfulResponse(response) && response.data) {
            this.clearFlowToken();
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Profile completion failed';
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Profile completion failed');
        },
      });
  }

  ngOnDestroy(): void {
    this.stopTimer(false);
  }

  private resetOtpValues(): void {
    this.otpValues = Array(this.otpArray.length).fill('');
  }

  private resetRoleSelection(): void {
    this.availableRoles = [];
    this.selectedRoleUserId = null;
    this.clearFlowToken();
  }

  private clearFlowToken(): void {
    this.flowToken = null;
  }

  private applyOtpFromResponse(response?: Partial<SendOtpResponse> | null): void {
    if (!environment.otpAutoFillEnabled) {
      return;
    }

    const otp = response?.otp?.toString().padStart(this.otpArray.length, '0');

    if (!otp) {
      return;
    }

    this.otpValues = otp.slice(0, this.otpArray.length).split('');
  }

  private setDobValue(value: string): void {
    const dobControl = this.profileForm.get('dob');

    this.profileForm.patchValue({ dob: value });
    dobControl?.markAsTouched();
    dobControl?.markAsDirty();
    dobControl?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

  private formatDateValue(date: Date | undefined): string {
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    return this.toIsoDate(date);
  }

  private formatIsoDateForDisplay(value: string): string {
    const date = this.parseIsoDate(value);

    if (!date) {
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${day}-${month}-${date.getFullYear()}`;
  }

  private defaultDobCalendarView(): Date {
    const today = new Date();

    return new Date(today.getFullYear() - 25, today.getMonth(), 1);
  }

  private syncDobCalendarView(): void {
    const selectedDate = this.parseIsoDate(`${this.profileForm.get('dob')?.value ?? ''}`);
    this.dobCalendarView = selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : this.defaultDobCalendarView();
  }

  private buildDobYearOptions(): number[] {
    return Array.from({ length: 100 }, (_, index) => this.currentYear - 1 - index);
  }

  private normalizeDob(value: unknown): string {
    let normalized = '';

    if (typeof value === 'string') {
      const trimmed = value.trim();
      normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
    } else if (value instanceof Date) {
      normalized = this.formatDateValue(value);
    }

    const date = normalized ? this.parseIsoDate(normalized) : null;

    if (!date || !this.isBeforeToday(date)) {
      return '';
    }

    return normalized;
  }

  private prepareProfileFormForSubmit(): void {
    const name = `${this.profileForm.get('name')?.value ?? ''}`.trim();
    const phone = `${this.profileForm.get('phone')?.value ?? ''}`.replace(/\D+/g, '').slice(0, 10);

    this.profileForm.patchValue({ name, phone });
  }

  private dobBeforeTodayValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = `${control.value ?? ''}`.trim();

      if (!value) {
        return null;
      }

      const date = this.parseIsoDate(value);

      return date && this.isBeforeToday(date) ? null : { dateBeforeToday: true };
    };
  }

  private isBeforeToday(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate < today;
  }

  private getFirstEmptyOtpIndex(): number {
    return this.otpValues.findIndex((value) => !value);
  }

  private navigateAfterAuth(data: LoginData): void {
    localStorage.setItem('dashboardsetting', JSON.stringify(data.user.dashboard));
    this.NavigationService.loadNavigation();
    this.userProfileService.loadProfileFromStorage();
    void this.router.navigate(['/application', data.user.dashboard?.dashboardUrl]);
  }

  private getFieldName(field: string): string {
    const map: Record<string, string> = {
      emailId: 'Email',
      name: 'Name',
      phone: 'Phone',
      dob: 'Date of Birth',
      gender: 'Gender',
    };

    return map[field] || field;
  }

  roleProfileImageUrl(role: RoleSelectionOption): string | null {
    const fileName = typeof role.profile_img === 'string' ? role.profile_img.trim() : '';

    if (!fileName) {
      return null;
    }

    const normalizedFileName = fileName.split('/').pop();

    if (!normalizedFileName) {
      return null;
    }

    return this.userProfileService.buildPrivateFileUrl(
      `uploads/user/profile/${normalizedFileName}`,
    );
  }

  roleInitials(role: RoleSelectionOption): string {
    const source = (role.role_name || 'Role').trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return 'R';
    }

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private stopTimer(resetValue = true): void {
    clearInterval(this.interval);
    this.interval = undefined;

    if (resetValue) {
      this.timer = 60;
    }
  }

  private getApiErrorMessage(error: unknown, fallbackMessage: string): string {
    const apiError = error as {
      error?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };

    const validationErrors = apiError?.error?.errors;

    if (validationErrors) {
      const firstValidationError = Object.values(validationErrors)
        .flat()
        .find((message): message is string => typeof message === 'string' && message.length > 0);

      if (firstValidationError) {
        return firstValidationError;
      }
    }

    return apiError?.error?.message || fallbackMessage;
  }

  private isSuccessfulResponse(response?: { success?: boolean; status?: boolean } | null): boolean {
    return response?.success === true || response?.status === true;
  }
}
