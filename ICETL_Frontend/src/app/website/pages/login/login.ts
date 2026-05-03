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
import { AuthService } from '../../../commonServices/auth.service';

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
  isNewUser = false;
  isOtpSent = false;
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

    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.isNewUser = false;
    this.profileForm.reset();

    try {
      const response: any = await lastValueFrom(
        this.authService.sendOtp(this.loginForm.value.user),
      );

      if (response.success) {
        this.otpValues = Array(this.otpArray.length).fill('');
        this.isOtpSent = true;
        this.startTimer();
        this.isLoading = false;
        this.cdr.detectChanges();

        // Wait until the OTP inputs exist in the DOM before focusing.
        setTimeout(() => this.focusInput(0), 0);
        return;
      }

      this.errorMessage = response.message || 'Failed to send OTP';
      this.isLoading = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.log(error);
      this.errorMessage = this.getApiErrorMessage(error, 'Failed to send OTP');
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onOtpInput(event: any, index: number) {
    const value = event.target.value;

    if (!/^[0-9]$/.test(value)) {
      event.target.value = '';
      return;
    }

    this.otpValues[index] = value;

    if (index < this.otpArray.length - 1) this.focusInput(index + 1);
  }

  onKeyDown(event: any, index: number) {
    if (event.key === 'Backspace' && !event.target.value && index > 0) {
      this.focusInput(index - 1);
    }
  }

  focusInput(index: number) {
    const inputs = this.otpInputs.toArray();
    inputs[index]?.nativeElement.focus();
  }

  getOtp(): string {
    return this.otpValues.join('');
  }

  startTimer() {
    clearInterval(this.interval);
    this.timer = 60;

    this.interval = setInterval(() => {
      this.timer--;

      if (this.timer === 0) clearInterval(this.interval);

      this.cdr.detectChanges();
    }, 1000);
  }

  resendOtp() {
    this.sendOtp();
  }

  backToUserInput() {
    clearInterval(this.interval);
    this.timer = 60;
    this.otpValues = Array(this.otpArray.length).fill('');
    this.profileForm.reset();
    this.errorMessage = '';
    this.isNewUser = false;
    this.isOtpSent = false;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  onSubmit(event: Event) {
    event.preventDefault();

    const otp = this.getOtp();

    if (otp.length !== this.otpArray.length) {
      this.errorMessage = 'Enter valid 6 digit OTP';
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
        next: (response: any) => {
          if (response.success && response.is_new_user) {
            this.isNewUser = true;
            this.isLoading = false;
            this.errorMessage = '';
            this.cdr.detectChanges();
            return;
          }

          if (response.success && response.data) {
            clearInterval(this.interval);
            void this.router.navigate(['/application/dashboard']);
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

  completeProfile() {
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
        next: (response: any) => {
          if (response.success && response.data) {
            clearInterval(this.interval);
            void this.router.navigate(['/application/dashboard']);
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
        complete: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  private getApiErrorMessage(error: any, fallbackMessage: string): string {
    const validationErrors = error?.error?.errors;

    if (validationErrors) {
      const firstValidationError = Object.values(validationErrors)
        .flat()
        .find((message): message is string => typeof message === 'string' && message.length > 0);

      if (firstValidationError) return firstValidationError;
    }

    return error?.error?.message || fallbackMessage;
  }
}
