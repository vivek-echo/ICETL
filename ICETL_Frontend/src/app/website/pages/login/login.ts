import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
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

type LoginStep = 'identify' | 'otp' | 'role' | 'profile';

declare const $: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnDestroy, AfterViewChecked {
  loginForm: FormGroup;
  profileForm: FormGroup;
  private readonly dobInputSelector = '#profile-dob';
  private readonly maxDobDate = new Date();
  private readonly isBrowser: boolean;
  private dobDatepickerInitialized = false;
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
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.loginForm = this.fb.group({
      emailId: ['vivekjha0151@gmail.com', [Validators.required, Validators.email]],
    });

    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      dob: ['', Validators.required],
      gender: ['', Validators.required],
    });
  }

  ngAfterViewChecked(): void {
    if (this.currentStep === 'profile' && !this.dobDatepickerInitialized) {
      this.initializeDobDatepicker();
    }
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

  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  async sendOtp(): Promise<void> {
    this.submitted = true;

    if (this.loginForm.invalid) {
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
    this.destroyDobDatepicker();

    try {
      const response = await lastValueFrom(this.authService.sendOtp(this.loginForm.value.emailId));

      if (response?.success === false) {
        this.errorMessage = response.message || 'Failed to send OTP';
        return;
      }

      this.currentStep = 'otp';
      this.applyOtpFromResponse(response);
      this.startTimer();
      this.cdr.detectChanges();

      setTimeout(() => {
        const focusIndex = this.getFirstEmptyOtpIndex();
        if (focusIndex >= 0) {
          this.focusInput(focusIndex);
        }
      }, 0);
    } catch (error) {
      this.errorMessage = this.getApiErrorMessage(error, 'Failed to send OTP');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
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

  startTimer(): void {
    this.stopTimer(false);
    this.timer = 60;

    this.interval = setInterval(() => {
      this.timer--;

      if (this.timer === 0) {
        this.stopTimer(false);
      }

      this.cdr.detectChanges();
    }, 1000);
  }

  resendOtp(): void {
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
    this.destroyDobDatepicker();
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
      .subscribe({
        next: (response: VerifyOtpResponse<LoginData>) => {
          if (response.success && response.is_new_user) {
            this.stopTimer();
            this.resetOtpValues();
            this.resetRoleSelection();
            this.currentStep = 'profile';
            this.isLoading = false;
            this.errorMessage = '';
            this.cdr.detectChanges();
            setTimeout(() => this.initializeDobDatepicker(), 0);
            return;
          }

          if (response.success && response.is_multi_role_user && Array.isArray(response.roles) && response.roles.length > 0) {
            this.stopTimer();
            this.resetOtpValues();
            this.availableRoles = response.roles;
            this.selectedRoleUserId = response.roles[0]?.user_id ?? null;
            this.currentStep = 'role';
            this.isLoading = false;
            this.errorMessage = '';
            this.cdr.detectChanges();
            return;
          }

          if (response.success && response.data) {
            this.stopTimer();
            this.isLoading = false;
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Login failed';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Login failed');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  selectRole(role: RoleSelectionOption): void {
    if (!role?.user_id) {
      this.errorMessage = 'Please select a valid role';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.selectedRoleUserId = role.user_id;

    this.authService
      .selectRole({
        email: this.loginForm.value.emailId,
        user_id: role.user_id,
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.isLoading = false;
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Role selection failed';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Role selection failed');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  completeProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
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
        email: this.loginForm.value.emailId,
        ...this.profileForm.value,
        dob,
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.isLoading = false;
            this.navigateAfterAuth(response.data);
            return;
          }

          this.errorMessage = response.message || 'Profile completion failed';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Profile completion failed');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroyDobDatepicker();
    this.stopTimer(false);
  }

  private resetOtpValues(): void {
    this.otpValues = Array(this.otpArray.length).fill('');
  }

  private resetRoleSelection(): void {
    this.availableRoles = [];
    this.selectedRoleUserId = null;
  }

  private applyOtpFromResponse(response?: Partial<SendOtpResponse> | null): void {
    if (environment.production) {
      return;
    }

    const otp = response?.otp?.toString().padStart(this.otpArray.length, '0');

    if (!otp) {
      return;
    }

    this.otpValues = otp.slice(0, this.otpArray.length).split('');
  }

  openDobDatepicker(): void {
    this.initializeDobDatepicker();

    if (!this.canUseDatepicker()) {
      return;
    }

    $(this.dobInputSelector).datepicker('show');
  }

  private initializeDobDatepicker(): void {
    if (this.dobDatepickerInitialized || this.currentStep !== 'profile' || !this.canUseDatepicker()) {
      return;
    }

    const dobInput = $(this.dobInputSelector);

    if (!dobInput.length) {
      return;
    }

    dobInput
      .datepicker({
        autoclose: true,
        clearBtn: true,
        container: 'body',
        endDate: this.maxDobDate,
        forceParse: false,
        format: 'yyyy-mm-dd',
        orientation: 'top auto',
        startView: 2,
        todayHighlight: true,
        zIndexOffset: 1100,
      })
      .on('changeDate.icetlDob', (event: { date?: Date }) => {
        this.setDobValue(this.formatDatepickerDate(event.date));
      })
      .on('clearDate.icetlDob', () => {
        this.setDobValue('');
      })
      .on('hide.icetlDob', () => {
        this.profileForm.get('dob')?.markAsTouched();
        this.cdr.detectChanges();
      });

    this.dobDatepickerInitialized = true;
  }

  private destroyDobDatepicker(): void {
    if (!this.canUseDatepicker()) {
      this.dobDatepickerInitialized = false;
      return;
    }

    const dobInput = $(this.dobInputSelector);

    if (dobInput.length) {
      dobInput.off('.icetlDob');
      dobInput.datepicker('destroy');
    }

    this.dobDatepickerInitialized = false;
  }

  private canUseDatepicker(): boolean {
    return this.isBrowser && typeof $ !== 'undefined' && typeof $.fn?.datepicker === 'function';
  }

  private setDobValue(value: string): void {
    const dobControl = this.profileForm.get('dob');

    this.profileForm.patchValue({ dob: value });
    dobControl?.markAsTouched();
    dobControl?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  private formatDatepickerDate(date: Date | undefined): string {
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private normalizeDob(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
    }

    if (value instanceof Date) {
      return this.formatDatepickerDate(value);
    }

    return '';
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

  roleProfileImageUrl(role: RoleSelectionOption): string | null {
    const fileName = typeof role.profile_img === 'string' ? role.profile_img.trim() : '';

    if (!fileName) {
      return null;
    }

    const normalizedFileName = fileName.split('/').pop();

    if (!normalizedFileName) {
      return null;
    }

    return this.userProfileService.buildPrivateFileUrl(`uploads/user/profile/${normalizedFileName}`);
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
}
