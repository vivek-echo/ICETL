import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService, SendOtpResponse, VerifyOtpResponse } from '../../../commonServices/auth.service';

type LoginStep = 'identify' | 'otp' | 'profile';

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
  submitted = false;
  isLoading = false;
  errorMessage = '';
  currentStep: LoginStep = 'identify';
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
  ) {
    this.loginForm = this.fb.group({
      user: ['', Validators.required],
    });

    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get stepTitle(): string {
    switch (this.currentStep) {
      case 'otp':
        return 'Verify OTP';
      case 'profile':
        return 'Complete Your Profile';
      default:
        return 'Login';
    }
  }

  get stepDescription(): string {
    switch (this.currentStep) {
      case 'otp':
        return `Enter the 6-digit code sent to ${this.loginForm.value.user}.`;
      case 'profile':
        return 'Your OTP is verified. Add the remaining details to finish creating the account.';
      default:
        return 'Use your mobile number to receive a one-time password and continue.';
    }
  }

  get stepLabel(): string {
    switch (this.currentStep) {
      case 'otp':
        return 'Step 2 of 3';
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
    this.profileForm.reset();

    try {
      const response = await lastValueFrom(this.authService.sendOtp(this.loginForm.value.user));

      if (response.success) {
        this.applyOtpFromResponse(response);
        this.currentStep = 'otp';
        this.startTimer();
        this.isLoading = false;
        this.cdr.detectChanges();

        // Wait until the OTP inputs exist in the DOM before focusing.
        setTimeout(() => {
          const focusIndex = this.getFirstEmptyOtpIndex();
          if (focusIndex >= 0) {
            this.focusInput(focusIndex);
          }
        }, 0);
        return;
      }

      this.errorMessage = response.message || 'Failed to send OTP';
      this.isLoading = false;
      this.cdr.detectChanges();
    } catch (error) {
      this.errorMessage = this.getApiErrorMessage(error, 'Failed to send OTP');
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
    this.profileForm.reset();
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
        user: this.loginForm.value.user,
        otp,
      })
      .subscribe({
        next: (response: VerifyOtpResponse<unknown>) => {
          if (response.success && response.is_new_user) {
            this.stopTimer();
            this.resetOtpValues();
            this.currentStep = 'profile';
            this.isLoading = false;
            this.errorMessage = '';
            this.cdr.detectChanges();
            return;
          }

          if (response.success && response.data) {
            this.stopTimer();
            this.isLoading = false;
            const data: any = response.data;
            localStorage.setItem('dashboardsetting', data.user.dashboard.dashboardUrl);
            void this.router.navigate(['/application', data.user.dashboard.dashboardUrl]);
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

  completeProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService
      .completeProfile({
        user: this.loginForm.value.user,
        ...this.profileForm.value,
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log(response.data);
            this.isLoading = false;
            const data: any = response.data;
            localStorage.setItem('dashboardsetting', data.user.dashboard.dashboardUrl);
            void this.router.navigate(['/application', data.user.dashboard.dashboardUrl]);
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
    this.stopTimer(false);
  }

  private resetOtpValues(): void {
    this.otpValues = Array(this.otpArray.length).fill('');
  }

  private applyOtpFromResponse(response: SendOtpResponse): void {
    if (environment.production) {
      return;
    }

    const otp = response.otp?.toString().padStart(this.otpArray.length, '0');

    if (!otp) {
      return;
    }

    this.otpValues = otp.slice(0, this.otpArray.length).split('');
  }

  private getFirstEmptyOtpIndex(): number {
    const index = this.otpValues.findIndex((value) => !value);
    return index;
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
