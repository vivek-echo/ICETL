import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  Component,
  ChangeDetectorRef,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  QueryList,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IDropdownSettings, NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../commonServices/form-validation-service';
import { FormValidationRules } from '../../../commonServices/form-validation-rules';
import { SpinnerService } from '../../../commonServices/spinner/spinner.service';
import {
  CompleteInstructorOnboardingPayload,
  DropdownOption,
  InstructorDocumentRecord,
  InstructorFlowType,
  InstructorProfile,
  SaveAccountInformationPayload,
  SaveDocumentsAndSocialLinksFormValue,
  SaveProfessionalInformationFormValue,
  SaveSkillsAndCategoriesPayload,
} from '../../../services/instructor-registration.model';
import { InstructorRegistrationService } from '../../../services/instructor-registration.service';
import { OtpService } from '../../../services/otp.service';

type UploadKey = 'profilePhoto' | 'governmentId' | 'resume' | 'certifications';
type OnboardingStage = 'email' | 'otp' | 'form';

interface StepMeta {
  title: string;
  caption: string;
  icon: string;
}

interface HighlightItem {
  icon: string;
  title: string;
  description: string;
}

interface BenefitItem {
  icon: string;
  title: string;
  description: string;
}

interface StatisticItem {
  label: string;
  value: string;
  icon: string;
}

interface UploadState {
  title: string;
  hint: string;
  icon: string;
  accept: string;
  multiple: boolean;
  dragging: boolean;
  previewUrl: string | null;
  fileNames: string[];
  persisted: boolean;
  maxSizeBytes: number;
  allowedExtensions: string[];
}

interface CalendarDay {
  date: Date;
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-become-instructor',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgMultiSelectDropDownModule],
  templateUrl: './become-instructor.html',
  styleUrl: './become-instructor.scss',
})
export class BecomeInstructor implements OnDestroy {
  @ViewChild('pageTop') private pageTop?: ElementRef<HTMLElement>;
  @ViewChild('journeyStart') private journeyStart?: ElementRef<HTMLElement>;
  @ViewChild('formCard') private formCard?: ElementRef<HTMLElement>;
  @ViewChildren('otpBox') private otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef);
  private readonly spinner = inject(SpinnerService);
  private readonly otpService = inject(OtpService);
  private readonly alertHelper = inject(AlertHelperService);
  private readonly formValidationService = inject(FormValidationService);
  private readonly instructorRegistrationService = inject(InstructorRegistrationService);
  private readonly isBrowser: boolean;
  private readonly canUseObjectUrl: boolean;
  private readonly emailSpinnerKey = 'become-instructor-email';
  private readonly otpSpinnerKey = 'become-instructor-otp';
  private readonly stepSpinnerKey = 'become-instructor-step';
  private readonly submitSpinnerKey = 'become-instructor-submit';

  private otpExpiryInterval?: ReturnType<typeof setInterval>;
  private resendInterval?: ReturnType<typeof setInterval>;

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
  readonly stepMeta: StepMeta[] = [
    {
      title: 'Account Information',
      caption: 'Secure your instructor account and complete your core identity details.',
      icon: 'fa-regular fa-user',
    },
    {
      title: 'Professional Information',
      caption: 'Show learners the expertise, credibility, and story behind your teaching.',
      icon: 'fa-solid fa-briefcase',
    },
    {
      title: 'Skills & Categories',
      caption: 'Tag the skills, course categories, and languages you can confidently teach.',
      icon: 'fa-solid fa-layer-group',
    },
    {
      title: 'Documents & Social Links',
      caption: 'Upload verification documents and add public trust signals to speed up approval.',
      icon: 'fa-solid fa-file-shield',
    },
    {
      title: 'Final Agreement',
      caption: 'Confirm policy acceptance and submit your instructor application for review.',
      icon: 'fa-solid fa-circle-check',
    },
  ];
  readonly journeyHighlights: HighlightItem[] = [
    {
      icon: 'fa-solid fa-envelope-open-text',
      title: 'OTP-first security',
      description:
        'Every onboarding draft starts with email verification so your progress stays tied to a verified inbox.',
    },
    {
      icon: 'fa-solid fa-arrows-rotate',
      title: 'Resume anytime',
      description:
        'Returning instructors can verify their email and continue from the exact saved onboarding step.',
    },
    {
      icon: 'fa-solid fa-cloud-arrow-up',
      title: 'Protected uploads',
      description:
        'Profile images, government IDs, resumes, and certifications are validated before they are saved.',
    },
  ];
  readonly benefits: BenefitItem[] = [
    {
      icon: 'fa-solid fa-sack-dollar',
      title: 'Earn Money',
      description:
        'Turn your expertise into premium courses, cohort programs, and recurring learner revenue.',
    },
    {
      icon: 'fa-solid fa-lightbulb',
      title: 'Inspire Students',
      description:
        'Create transformation-focused learning experiences that help students grow with confidence.',
    },
    {
      icon: 'fa-solid fa-bullhorn',
      title: 'Build Your Brand',
      description:
        'Launch a polished instructor profile backed by ICETL trust, visibility, and platform reach.',
    },
    {
      icon: 'fa-solid fa-earth-asia',
      title: 'Teach Globally',
      description:
        'Reach learners across regions and languages with a scalable modern teaching presence.',
    },
  ];
  readonly statistics: StatisticItem[] = [
    { label: 'Students Reached', value: '150K+', icon: 'fa-solid fa-user-graduate' },
    { label: 'Courses Published', value: '3,800+', icon: 'fa-solid fa-book-open-reader' },
    { label: 'Expert Instructors', value: '920+', icon: 'fa-solid fa-chalkboard-user' },
  ];
  readonly countries = [
    'India',
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'Singapore',
    'United Arab Emirates',
    'Germany',
  ];
  readonly preferredLanguages = [
    'English',
    'Hindi',
    'Spanish',
    'French',
    'German',
    'Arabic',
    'Tamil',
    'Bengali',
  ];
  readonly genderOptions = [
    { label: 'Male', value: '1' },
    { label: 'Female', value: '2' },
  ];
  readonly qualifications = [
    "Bachelor's Degree",
    "Master's Degree",
    'Doctorate / PhD',
    'Professional Certification',
    'Industry Diploma',
    'Bootcamp / Vocational Training',
  ];
  readonly skillOptions: DropdownOption[] = [
    { itemId: 1, itemText: 'Angular' },
    { itemId: 2, itemText: 'Data Science' },
    { itemId: 3, itemText: 'Machine Learning' },
    { itemId: 4, itemText: 'UI/UX Design' },
    { itemId: 5, itemText: 'Python' },
    { itemId: 6, itemText: 'Cloud Computing' },
    { itemId: 7, itemText: 'Project Management' },
    { itemId: 8, itemText: 'Cybersecurity' },
    { itemId: 9, itemText: 'Digital Marketing' },
    { itemId: 10, itemText: 'Leadership Coaching' },
  ];
  readonly categoryOptions: DropdownOption[] = [
    { itemId: 1, itemText: 'Web Development' },
    { itemId: 2, itemText: 'Artificial Intelligence' },
    { itemId: 3, itemText: 'Business & Leadership' },
    { itemId: 4, itemText: 'Creative Design' },
    { itemId: 5, itemText: 'Finance & Accounting' },
    { itemId: 6, itemText: 'Language Learning' },
    { itemId: 7, itemText: 'Software Testing' },
    { itemId: 8, itemText: 'Career Development' },
  ];
  readonly teachingLanguageOptions: DropdownOption[] = [
    { itemId: 1, itemText: 'English' },
    { itemId: 2, itemText: 'Hindi' },
    { itemId: 3, itemText: 'French' },
    { itemId: 4, itemText: 'German' },
    { itemId: 5, itemText: 'Spanish' },
    { itemId: 6, itemText: 'Tamil' },
    { itemId: 7, itemText: 'Bengali' },
    { itemId: 8, itemText: 'Arabic' },
  ];
  readonly dropdownSettings: IDropdownSettings = {
    allowSearchFilter: true,
    closeDropDownOnSelection: false,
    enableCheckAll: false,
    idField: 'itemId',
    itemsShowLimit: 3,
    maxHeight: 240,
    singleSelection: false,
    textField: 'itemText',
  };
  readonly uploads: Record<UploadKey, UploadState> = {
    profilePhoto: {
      title: 'Profile Photo',
      hint: 'PNG, JPG or WEBP up to 4 MB. Best results: 600 x 600 square image.',
      icon: 'fa-solid fa-camera-retro',
      accept: '.png,.jpg,.jpeg,.webp',
      multiple: false,
      dragging: false,
      previewUrl: null,
      fileNames: [],
      persisted: false,
      maxSizeBytes: 4 * 1024 * 1024,
      allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
    },
    governmentId: {
      title: 'Government ID',
      hint: 'PDF, JPG, PNG or WEBP up to 5 MB.',
      icon: 'fa-solid fa-id-card',
      accept: '.pdf,.png,.jpg,.jpeg,.webp',
      multiple: false,
      dragging: false,
      previewUrl: null,
      fileNames: [],
      persisted: false,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
    },
    resume: {
      title: 'Resume / CV',
      hint: 'PDF, DOC or DOCX accepted up to 10 MB.',
      icon: 'fa-solid fa-file-lines',
      accept: '.pdf,.doc,.docx',
      multiple: false,
      dragging: false,
      previewUrl: null,
      fileNames: [],
      persisted: false,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedExtensions: ['pdf', 'doc', 'docx'],
    },
    certifications: {
      title: 'Certifications',
      hint: 'Add one or more certificates in PDF, DOC, DOCX, PNG, JPG or WEBP format.',
      icon: 'fa-solid fa-award',
      accept: '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp',
      multiple: true,
      dragging: false,
      previewUrl: null,
      fileNames: [],
      persisted: false,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedExtensions: ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'],
    },
  };

  readonly emailEntryForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
  });
  readonly registrationForm = this.fb.group({
    account: this.fb.group(
      {
        fullName: ['', FormValidationRules.requiredName()],
        mobileNumber: ['', FormValidationRules.requiredMobile()],
        gender: ['', Validators.required],
        dob: ['', Validators.required],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
        country: ['', Validators.required],
        preferredLanguage: ['', Validators.required],
      },
      { validators: passwordMatchValidator() },
    ),
    professional: this.fb.group({
      professionalHeadline: [
        '',
        [Validators.required, Validators.minLength(10), Validators.maxLength(150)],
      ],
      bio: ['', [Validators.required, Validators.minLength(80), Validators.maxLength(2000)]],
      profilePhoto: [null, Validators.required],
      yearsOfExperience: [
        null,
        [Validators.required, Validators.min(0), Validators.max(60), Validators.pattern(/^[0-9]+$/)],
      ],
      currentJobTitle: ['', [Validators.required, Validators.maxLength(150)]],
      currentOrganization: ['', [Validators.required, Validators.maxLength(150)]],
      highestQualification: ['', Validators.required],
    }),
    expertise: this.fb.group({
      skills: [[], [selectionRequiredValidator()]],
      teachingCategories: [[], [selectionRequiredValidator()]],
      languagesYouCanTeach: [[], [selectionRequiredValidator()]],
    }),
    documents: this.fb.group({
      governmentId: [null, Validators.required],
      resume: [null, Validators.required],
      certifications: [[], [selectionRequiredValidator()]],
      linkedInUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      gitHubUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      youTubeUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      portfolioWebsite: ['', Validators.pattern(/^https?:\/\/.+/i)],
    }),
    agreements: this.fb.group({
      acceptTerms: [false, Validators.requiredTrue],
      acceptInstructorPolicy: [false, Validators.requiredTrue],
      verifyInformation: [false, Validators.requiredTrue],
    }),
  });

  stage: OnboardingStage = 'email';
  currentStep = 0;
  furthestStepReached = 0;
  onboardingEmail = '';
  flowType: InstructorFlowType = 'new';
  hasExistingPassword = false;
  isSubmitting = false;
  isStepSaving = false;
  isDobCalendarOpen = false;
  dobCalendarView = this.defaultDobCalendarView();
  otpValues: string[] = ['', '', '', '', '', ''];
  otpExpiresIn = 0;
  resendIn = 0;
  otpStatusMessage = '';
  resumeBannerMessage = '';
  developmentOtp: string | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.canUseObjectUrl =
      this.isBrowser && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  }

  get accountGroup(): FormGroup {
    return this.registrationForm.get('account') as FormGroup;
  }

  get professionalGroup(): FormGroup {
    return this.registrationForm.get('professional') as FormGroup;
  }

  get expertiseGroup(): FormGroup {
    return this.registrationForm.get('expertise') as FormGroup;
  }

  get documentsGroup(): FormGroup {
    return this.registrationForm.get('documents') as FormGroup;
  }

  get agreementsGroup(): FormGroup {
    return this.registrationForm.get('agreements') as FormGroup;
  }

  get progressPercentage(): number {
    return ((this.currentStep + 1) / this.stepMeta.length) * 100;
  }

  get completionPercentage(): number {
    const trackedPaths = [
      'account.fullName',
      'account.mobileNumber',
      'account.gender',
      'account.dob',
      'account.country',
      'account.preferredLanguage',
      'professional.professionalHeadline',
      'professional.bio',
      'professional.profilePhoto',
      'professional.yearsOfExperience',
      'professional.currentJobTitle',
      'professional.currentOrganization',
      'professional.highestQualification',
      'expertise.skills',
      'expertise.teachingCategories',
      'expertise.languagesYouCanTeach',
      'documents.governmentId',
      'documents.resume',
      'documents.certifications',
      'agreements.acceptTerms',
      'agreements.acceptInstructorPolicy',
      'agreements.verifyInformation',
    ];

    if (!this.hasExistingPassword) {
      trackedPaths.unshift('account.password');
    }

    const completedCount = trackedPaths.filter((path) =>
      this.hasMeaningfulValue(this.getControl(path)?.value),
    ).length;

    return Math.round((completedCount / trackedPaths.length) * 100);
  }

  get stepLabel(): string {
    return `Step ${this.currentStep + 1} of ${this.stepMeta.length}`;
  }

  get otpCode(): string {
    return this.otpValues.join('');
  }

  get otpCanResend(): boolean {
    return this.resendIn === 0;
  }

  get formattedOtpTimer(): string {
    return this.formatTimer(this.otpExpiresIn);
  }

  get formattedResendTimer(): string {
    return this.formatTimer(this.resendIn);
  }

  get dobDisplayValue(): string {
    return this.formatIsoDateForDisplay(`${this.accountGroup.get('dob')?.value ?? ''}`);
  }

  get dobCalendarTitle(): string {
    return `${this.calendarMonths[this.dobCalendarView.getMonth()]} ${this.dobCalendarView.getFullYear()}`;
  }

  get dobCalendarDays(): CalendarDay[] {
    const selectedIso = `${this.accountGroup.get('dob')?.value ?? ''}`;
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
        date,
        day: date.getDate(),
        iso,
        isCurrentMonth: date.getMonth() === this.dobCalendarView.getMonth(),
        isSelected: iso === selectedIso,
        isToday: iso === todayIso,
        isDisabled: iso >= todayIso,
      };
    });
  }

  @HostListener('document:click')
  closeDobCalendar(): void {
    this.isDobCalendarOpen = false;
  }

  scrollToRegistrationSection(): void {
    this.journeyStart?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const control = this.accountGroup.get('dob');
    control?.setValue(day.iso);
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.isDobCalendarOpen = false;
  }

  clearDobDate(event: Event): void {
    event.stopPropagation();
    const control = this.accountGroup.get('dob');
    control?.setValue('');
    control?.markAsDirty();
    control?.markAsTouched();
    control?.updateValueAndValidity();
    this.syncDobCalendarView();
  }

  async submitEmail(): Promise<void> {
    if (!this.formValidationService.validateForm(this.emailEntryForm, this.getFieldName, this.el)) {
      return;
    }

    const email = `${this.emailEntryForm.get('email')?.value ?? ''}`.trim().toLowerCase();
    this.onboardingEmail = email;
    this.instructorRegistrationService.clearOnboardingSession();
    this.spinner.show();

    try {
      const response = await lastValueFrom(this.otpService.sendInstructorOtp(email));

      this.flowType = response.data.flowType;
      this.developmentOtp =
        response.data.otp !== null && response.data.otp !== undefined
          ? String(response.data.otp)
          : null;
      this.resumeBannerMessage = '';
      this.otpStatusMessage =
        this.flowType === 'resume'
          ? 'We found a saved instructor draft. Verify this OTP to continue from your last completed step.'
          : this.flowType === 'roleUpgrade'
            ? 'Your existing account is being upgraded into an instructor onboarding journey. Verify the OTP to continue.'
            : 'We sent a secure 6-digit OTP to your email. Verify it to unlock your instructor onboarding workspace.';

      this.resetOtpValues();
      this.startOtpTimers(response.data.expiresIn, response.data.resendAvailableIn);
      await this.transitionToStage('otp');
      this.scrollToRegistrationSection();
      setTimeout(() => this.focusOtpInput(0), 50);
    } catch (error) {
    } finally {
      this.spinner.hide();
    }
  }

  async resendOtp(): Promise<void> {
    if (!this.onboardingEmail || !this.otpCanResend) {
      return;
    }

    this.spinner.show(this.otpSpinnerKey);

    try {
      const response = await lastValueFrom(this.otpService.resendInstructorOtp(this.onboardingEmail));

      if (!response.status) {
        await this.alertHelper.error(
          this.extractErrorMessage(response.message, response.errors),
          'Unable to Resend OTP',
        );
        return;
      }

      this.developmentOtp =
        response.data.otp !== null && response.data.otp !== undefined
          ? String(response.data.otp)
          : null;
      this.resetOtpValues();
      this.otpStatusMessage = 'A fresh verification code has been sent to your email.';
      this.startOtpTimers(response.data.expiresIn, response.data.resendAvailableIn);
      setTimeout(() => this.focusOtpInput(0), 50);
    } catch (error) {
      await this.alertHelper.error(this.extractHttpError(error), 'Unable to Resend OTP');
    } finally {
      this.spinner.hide(this.otpSpinnerKey);
    }
  }

  backToEmail(): void {
    this.clearOtpTimers();
    this.resetOtpValues();
    this.otpStatusMessage = '';
    this.developmentOtp = null;
    void this.transitionToStage('email');
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(-1);

    input.value = sanitized;
    this.otpValues[index] = sanitized;

    if (sanitized && index < this.otpValues.length - 1) {
      this.focusOtpInput(index + 1);
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpValues[index] && index > 0) {
      this.focusOtpInput(index - 1);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';

    if (!pasted) {
      return;
    }

    this.otpValues = this.otpValues.map((_, index) => pasted[index] ?? '');
    this.syncOtpDomInputs();
    this.focusOtpInput(Math.min(pasted.length, this.otpValues.length - 1));
  }

  handleOtpSubmit(event: SubmitEvent): void {
    event.preventDefault();
    event.stopPropagation();
    void this.verifyOtp();
  }

  async verifyOtp(): Promise<void> {
    if (this.otpCode.length !== 6 || this.otpExpiresIn === 0) {
      await this.alertHelper.error(
        this.otpExpiresIn === 0
          ? 'Your OTP has expired. Please request a new code.'
          : 'Please enter the complete 6-digit OTP.',
        'OTP Verification',
      );
      return;
    }

    this.spinner.show(this.otpSpinnerKey);

    try {
      const response = await lastValueFrom(
        this.otpService.verifyInstructorOtp(this.onboardingEmail, this.otpCode),
      );

      if (!response.status) {
        await this.alertHelper.error(
          this.extractErrorMessage(response.message, response.errors),
          'OTP Verification Failed',
        );
        return;
      }

      this.instructorRegistrationService.storeOnboardingSession(response.data.onboardingAuth);
      this.flowType = response.data.flowType;
      this.clearOtpTimers();
      this.developmentOtp = null;
      this.applyInstructorProfile(response.data.instructor);

      if (response.data.instructor.onboardingCompleted) {
        this.instructorRegistrationService.clearOnboardingSession();
        this.spinner.hide(this.otpSpinnerKey);
        await this.alertHelper.info(
          'Your instructor application is already submitted. Please log in to continue.',
          'Application Already Submitted',
        );
        await this.router.navigate(['/login']);
        return;
      }

      this.resumeBannerMessage =
        this.flowType === 'resume'
          ? `Your instructor draft is ready. Continue from step ${response.data.currentStep}.`
          : this.flowType === 'roleUpgrade'
            ? 'Your existing account details have been connected to a new instructor onboarding draft.'
            : 'Your email is verified. Complete the remaining onboarding steps to submit your instructor profile.';

      this.hasExistingPassword =
        response.data.instructor.user?.hasPassword
        ?? response.data.onboardingAuth.user.hasPassword
        ?? false;
      this.configurePasswordValidators(!this.hasExistingPassword);
      this.currentStep = Math.max(0, Math.min(this.stepMeta.length - 1, response.data.currentStep - 1));
      this.furthestStepReached = Math.max(this.furthestStepReached, this.currentStep);
      await this.transitionToStage('form');
      this.scrollToForm();
    } catch (error) {
      await this.alertHelper.error(this.extractHttpError(error), 'OTP Verification Failed');
    } finally {
      this.spinner.hide(this.otpSpinnerKey);
    }
  }

  async nextStep(): Promise<void> {
    if (this.stage !== 'form' || this.isStepSaving) {
      return;
    }

    const stepIndex = this.currentStep;
    if (!this.validateStep(stepIndex, true)) {
      return;
    }

    this.isStepSaving = true;
    this.spinner.show();

    try {
      const response = await lastValueFrom(this.saveCurrentStep(stepIndex));

      if (!response.status) {
        await this.alertHelper.error(
          this.extractErrorMessage(response.message, response.errors),
          'Unable to Save Step',
        );
        return;
      }

      this.applyInstructorProfile(response.data.instructor);
      this.currentStep = Math.max(0, Math.min(this.stepMeta.length - 1, response.data.currentStep - 1));
      this.furthestStepReached = Math.max(this.furthestStepReached, this.currentStep);
      this.scrollToForm();
    } catch (error) {
      console.log(error)
    } finally {
      this.isStepSaving = false;
      this.spinner.hide();
    }
  }

  previousStep(): void {
    if (this.stage !== 'form' || this.currentStep === 0 || this.isStepSaving || this.isSubmitting) {
      return;
    }

    this.currentStep -= 1;
    this.scrollToForm();
  }

  async submitApplication(): Promise<void> {
    if (this.stage !== 'form') {
      return;
    }

    if (!this.formValidationService.validateForm(this.agreementsGroup, this.getFieldName, this.el)) {
      return;
    }

    this.isSubmitting = true;
    this.spinner.show(this.submitSpinnerKey);

    try {
      const payload: CompleteInstructorOnboardingPayload = {
        acceptTerms: !!this.agreementsGroup.get('acceptTerms')?.value,
        acceptInstructorPolicy: !!this.agreementsGroup.get('acceptInstructorPolicy')?.value,
        verifyInformation: !!this.agreementsGroup.get('verifyInformation')?.value,
      };

      const response = await lastValueFrom(
        this.instructorRegistrationService.completeInstructorOnboarding(payload),
      );

      if (!response.status) {
        await this.alertHelper.error(
          this.extractErrorMessage(response.message, response.errors),
          'Unable to Complete Registration',
        );
        return;
      }

      this.applyInstructorProfile(response.data.instructor);
      this.currentStep = 4;
      this.furthestStepReached = 4;
      this.isSubmitting = false;
      this.spinner.hide(this.submitSpinnerKey);

      await this.alertHelper.success(
        response.message || 'Your instructor application has been submitted successfully.',
        'Application Submitted',
      );

      this.instructorRegistrationService.clearOnboardingSession();
      await this.router.navigate(['/login']);
    } catch (error) {
      await this.alertHelper.error(
        this.extractHttpError(error),
        'Unable to Complete Registration',
      );
    } finally {
      if (this.isSubmitting) {
        this.isSubmitting = false;
        this.spinner.hide(this.submitSpinnerKey);
      }
    }
  }

  goToStep(stepIndex: number): void {
    if (!this.canNavigateToStep(stepIndex)) {
      return;
    }

    this.currentStep = stepIndex;
    this.scrollToForm();
  }

  canNavigateToStep(stepIndex: number): boolean {
    return this.stage === 'form' && stepIndex >= 0 && stepIndex <= this.furthestStepReached;
  }

  hasControlValue(path: string): boolean {
    return this.hasMeaningfulValue(this.getControl(path)?.value);
  }

  isControlSuccessful(path: string): boolean {
    const control = this.getControl(path);

    if (!control || this.isInvalid(path)) {
      return false;
    }

    return !!control.valid && !!(control.touched || control.dirty) && this.hasMeaningfulValue(control.value);
  }

  isInvalid(path: string): boolean {
    const control = this.getControl(path);
    const isTouched = !!control && (control.touched || control.dirty);
    const isConfirmPasswordMismatch =
      path === 'account.confirmPassword' && this.accountGroup.hasError('mismatch') && isTouched;

    return (!!control && control.invalid && isTouched) || isConfirmPasswordMismatch;
  }

  errorFor(path: string): string {
    const control = this.getControl(path);

    if (path === 'account.confirmPassword' && this.accountGroup.hasError('mismatch')) {
      return 'Passwords do not match.';
    }

    if (!control?.errors || !(control.touched || control.dirty)) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required.';
    }

    if (control.errors['requiredTrue']) {
      return 'Please accept this agreement to continue.';
    }

    if (control.errors['email']) {
      return 'Enter a valid email address.';
    }

    if (control.errors['minlength']) {
      return `Please enter at least ${control.errors['minlength'].requiredLength} characters.`;
    }

    if (control.errors['maxlength']) {
      return `Please keep this under ${control.errors['maxlength'].requiredLength} characters.`;
    }

    if (control.errors['pattern']) {
      if (path === 'account.fullName') {
        return 'Full name can contain only alphabets and spaces.';
      }

      if (path === 'account.mobileNumber') {
        return 'Mobile number must be exactly 10 digits.';
      }

      if (path === 'professional.yearsOfExperience') {
        return 'Years of experience must be a whole number.';
      }

      return 'Enter a valid value in the expected format.';
    }

    if (control.errors['min']) {
      return `Value should be at least ${control.errors['min'].min}.`;
    }

    if (control.errors['max']) {
      return `Value should not be more than ${control.errors['max'].max}.`;
    }

    if (control.errors['selectionRequired']) {
      return 'Select at least one option.';
    }

    return 'Please review this field.';
  }

  sanitizeFullNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^A-Za-z ]+/g, '').slice(0, 50);

    if (input.value !== sanitized) {
      input.value = sanitized;
      this.accountGroup.get('fullName')?.setValue(sanitized);
    }
  }

  sanitizeMobileNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '').slice(0, 10);

    if (input.value !== sanitized) {
      input.value = sanitized;
      this.accountGroup.get('mobileNumber')?.setValue(sanitized);
    }
  }

  preventNegativeNumberKeys(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.'].includes(event.key)) {
      event.preventDefault();
    }
  }

  sanitizeYearsOfExperienceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');

    if (input.value !== sanitized) {
      input.value = sanitized;
      this.professionalGroup.get('yearsOfExperience')?.setValue(sanitized);
    }
  }

  onFilesSelected(event: Event, key: UploadKey): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    this.assignFiles(key, files);
    input.value = '';
  }

  onDragOver(event: DragEvent, key: UploadKey): void {
    event.preventDefault();
    this.uploads[key].dragging = true;
  }

  onDragLeave(event: DragEvent, key: UploadKey): void {
    event.preventDefault();
    this.uploads[key].dragging = false;
  }

  onDrop(event: DragEvent, key: UploadKey): void {
    event.preventDefault();
    this.uploads[key].dragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []);

    this.assignFiles(key, files);
  }

  async downloadPersistedUpload(key: UploadKey, index = 0): Promise<void> {
    const controlValue = this.getControl(this.uploadControlPath(key))?.value;
    const documents = Array.isArray(controlValue) ? controlValue : controlValue ? [controlValue] : [];
    const document = documents[index] as InstructorDocumentRecord | undefined;
    const filePath = `${document?.filePath ?? ''}`.trim();

    if (!filePath) {
      return;
    }

    const fileName = document?.originalName || document?.fileName || this.basename(filePath);

    try {
      await lastValueFrom(
        this.instructorRegistrationService.downloadPrivateFile(
          filePath,
          fileName,
        ),
      );
    } catch (error) {
      await this.alertHelper.error(this.extractHttpError(error), 'Unable to Download File');
    }
  }

  removeUpload(key: UploadKey): void {
    if (this.uploads[key].persisted) {
      return;
    }

    const control = this.getControl(this.uploadControlPath(key));

    if (key === 'profilePhoto') {
      this.revokeProfilePreviewIfNeeded(this.uploads.profilePhoto.previewUrl);
    }

    control?.setValue(key === 'certifications' ? [] : null);
    control?.markAsTouched();
    control?.updateValueAndValidity();

    this.uploads[key] = {
      ...this.uploads[key],
      previewUrl: null,
      fileNames: [],
      persisted: false,
    };
  }

  ngOnDestroy(): void {
    this.clearOtpTimers();
    this.revokeProfilePreviewIfNeeded(this.uploads.profilePhoto.previewUrl);
  }

  private configurePasswordValidators(requirePassword: boolean): void {
    const passwordControl = this.accountGroup.get('password');
    const confirmPasswordControl = this.accountGroup.get('confirmPassword');

    if (!passwordControl || !confirmPasswordControl) {
      return;
    }

    passwordControl.clearValidators();
    confirmPasswordControl.clearValidators();

    if (requirePassword) {
      passwordControl.setValidators([Validators.required, Validators.minLength(8)]);
      confirmPasswordControl.setValidators([Validators.required]);
    } else {
      passwordControl.setValidators([Validators.minLength(8)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
    confirmPasswordControl.updateValueAndValidity({ emitEvent: false });
    this.accountGroup.updateValueAndValidity({ emitEvent: false });
  }

  private saveCurrentStep(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return this.instructorRegistrationService.saveAccountInformation(
          this.buildAccountInformationPayload(),
        );
      case 1:
        return this.instructorRegistrationService.saveProfessionalInformation(
          this.buildProfessionalInformationPayload(),
        );
      case 2:
        return this.instructorRegistrationService.saveSkillsAndCategories(
          this.buildSkillsAndCategoriesPayload(),
        );
      case 3:
        return this.instructorRegistrationService.saveDocumentsAndSocialLinks(
          this.buildDocumentsAndSocialLinksPayload(),
        );
      default:
        throw new Error(`Unsupported onboarding step index: ${stepIndex}`);
    }
  }

  private buildAccountInformationPayload(): SaveAccountInformationPayload {
    return {
      fullName: `${this.accountGroup.get('fullName')?.value ?? ''}`.trim(),
      mobileNumber: `${this.accountGroup.get('mobileNumber')?.value ?? ''}`.trim(),
      gender: `${this.accountGroup.get('gender')?.value ?? ''}`.trim(),
      dob: `${this.accountGroup.get('dob')?.value ?? ''}`.trim(),
      password: `${this.accountGroup.get('password')?.value ?? ''}`.trim() || undefined,
      confirmPassword:
        `${this.accountGroup.get('confirmPassword')?.value ?? ''}`.trim() || undefined,
      country: `${this.accountGroup.get('country')?.value ?? ''}`.trim(),
      preferredLanguage: `${this.accountGroup.get('preferredLanguage')?.value ?? ''}`.trim(),
    };
  }

  private buildProfessionalInformationPayload(): SaveProfessionalInformationFormValue {
    return {
      professionalHeadline: `${this.professionalGroup.get('professionalHeadline')?.value ?? ''}`.trim(),
      bio: `${this.professionalGroup.get('bio')?.value ?? ''}`.trim(),
      profilePhoto: this.extractSingleFile(this.professionalGroup.get('profilePhoto')?.value),
      yearsOfExperience: Number(this.professionalGroup.get('yearsOfExperience')?.value ?? 0),
      currentJobTitle: `${this.professionalGroup.get('currentJobTitle')?.value ?? ''}`.trim(),
      currentOrganization: `${this.professionalGroup.get('currentOrganization')?.value ?? ''}`.trim(),
      highestQualification: `${this.professionalGroup.get('highestQualification')?.value ?? ''}`.trim(),
    };
  }

  private buildSkillsAndCategoriesPayload(): SaveSkillsAndCategoriesPayload {
    return {
      skills: this.selectedTextValues(this.expertiseGroup.get('skills')?.value),
      teachingCategories: this.selectedTextValues(
        this.expertiseGroup.get('teachingCategories')?.value,
      ),
      languagesYouCanTeach: this.selectedTextValues(
        this.expertiseGroup.get('languagesYouCanTeach')?.value,
      ),
    };
  }

  private buildDocumentsAndSocialLinksPayload(): SaveDocumentsAndSocialLinksFormValue {
    return {
      governmentId: this.extractSingleFile(this.documentsGroup.get('governmentId')?.value),
      resume: this.extractSingleFile(this.documentsGroup.get('resume')?.value),
      certifications: this.extractFileArray(this.documentsGroup.get('certifications')?.value),
      linkedInUrl: `${this.documentsGroup.get('linkedInUrl')?.value ?? ''}`.trim() || undefined,
      gitHubUrl: `${this.documentsGroup.get('gitHubUrl')?.value ?? ''}`.trim() || undefined,
      youTubeUrl: `${this.documentsGroup.get('youTubeUrl')?.value ?? ''}`.trim() || undefined,
      portfolioWebsite:
        `${this.documentsGroup.get('portfolioWebsite')?.value ?? ''}`.trim() || undefined,
    };
  }

  private selectedTextValues(values: DropdownOption[] | null | undefined): string[] {
    return (values ?? []).map((item) => item.itemText);
  }

  private applyInstructorProfile(profile: InstructorProfile): void {
    this.onboardingEmail = profile.user?.email?.trim() || this.onboardingEmail;
    this.emailEntryForm.patchValue({ email: this.onboardingEmail }, { emitEvent: false });

    this.accountGroup.patchValue(
      {
        fullName: profile.user?.name?.trim() || '',
        mobileNumber: profile.user?.phone?.trim() || '',
        gender: profile.gender || profile.user?.gender || '',
        dob: profile.dob || profile.user?.dob || '',
        password: '',
        confirmPassword: '',
        country: profile.country || '',
        preferredLanguage: profile.preferredLanguage || '',
      },
      { emitEvent: false },
    );

    this.professionalGroup.patchValue(
      {
        professionalHeadline: profile.headline || '',
        bio: profile.bio || '',
        yearsOfExperience: profile.experienceYears ?? null,
        currentJobTitle: profile.currentJobTitle || '',
        currentOrganization: profile.currentOrganization || '',
        highestQualification: profile.qualification || '',
      },
      { emitEvent: false },
    );

    this.expertiseGroup.patchValue(
      {
        skills: this.mapValuesToOptions(profile.skills, this.skillOptions),
        teachingCategories: this.mapValuesToOptions(profile.categories, this.categoryOptions),
        languagesYouCanTeach: this.mapValuesToOptions(
          profile.languagesYouCanTeach,
          this.teachingLanguageOptions,
        ),
      },
      { emitEvent: false },
    );

    this.documentsGroup.patchValue(
      {
        linkedInUrl: profile.linkedinUrl || '',
        gitHubUrl: profile.githubUrl || '',
        youTubeUrl: profile.youtubeUrl || '',
        portfolioWebsite: profile.portfolioUrl || '',
      },
      { emitEvent: false },
    );

    this.syncUploadFromProfile(
      'profilePhoto',
      profile.documents.filter((document) => document.documentType === 'profilePhoto'),
    );
    this.syncUploadFromProfile(
      'governmentId',
      profile.documents.filter((document) => document.documentType === 'governmentId'),
    );
    this.syncUploadFromProfile(
      'resume',
      profile.documents.filter((document) => document.documentType === 'resume'),
    );
    this.syncUploadFromProfile(
      'certifications',
      profile.documents.filter((document) => document.documentType === 'certification'),
    );
  }

  private syncUploadFromProfile(key: UploadKey, documents: InstructorDocumentRecord[]): void {
    const control = this.getControl(this.uploadControlPath(key));
    const documentValue = this.uploads[key].multiple ? documents : documents[0] ?? null;
    const previewUrl =
      key === 'profilePhoto'
        ? this.instructorRegistrationService.buildStoredFileUrl(documents[0]?.filePath ?? null)
        : null;

    if (key === 'profilePhoto') {
      this.revokeProfilePreviewIfNeeded(this.uploads.profilePhoto.previewUrl);
    }

    control?.setValue(this.uploads[key].multiple ? documents : documentValue, { emitEvent: false });
    control?.updateValueAndValidity({ emitEvent: false });

    this.uploads[key] = {
      ...this.uploads[key],
      previewUrl,
      fileNames: documents.map(
        (document) => document.originalName || document.fileName || this.basename(document.filePath),
      ),
      persisted: documents.length > 0,
    };
  }

  private mapValuesToOptions(values: string[], options: DropdownOption[]): DropdownOption[] {
    const normalizedValues = new Set((values ?? []).map((value) => value.toLowerCase()));

    return options.filter((option) => normalizedValues.has(option.itemText.toLowerCase()));
  }

  private assignFiles(key: UploadKey, files: File[]): void {
    if (!files.length) {
      return;
    }

    const normalizedFiles = this.uploads[key].multiple ? files : [files[0]];
    const validationMessage = this.validateSelectedFiles(key, normalizedFiles);
    if (validationMessage) {
      void this.alertHelper.error(validationMessage, 'Invalid File');
      return;
    }

    const control = this.getControl(this.uploadControlPath(key));

    if (key === 'profilePhoto') {
      this.revokeProfilePreviewIfNeeded(this.uploads.profilePhoto.previewUrl);
    }

    const previewUrl =
      key === 'profilePhoto' && normalizedFiles[0] && this.canUseObjectUrl
        ? URL.createObjectURL(normalizedFiles[0])
        : null;

    control?.setValue(this.uploads[key].multiple ? normalizedFiles : normalizedFiles[0]);
    control?.markAsTouched();
    control?.updateValueAndValidity();

    this.uploads[key] = {
      ...this.uploads[key],
      dragging: false,
      previewUrl,
      fileNames: normalizedFiles.map((file) => file.name),
      persisted: false,
    };
  }

  private validateSelectedFiles(key: UploadKey, files: File[]): string {
    const config = this.uploads[key];

    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

      if (!config.allowedExtensions.includes(extension)) {
        return `${config.title} supports only ${config.allowedExtensions.join(', ').toUpperCase()} files.`;
      }

      if (file.size > config.maxSizeBytes) {
        return `${config.title} exceeds the allowed size limit.`;
      }
    }

    return '';
  }

  private extractSingleFile(value: unknown): File | null {
    return this.isBrowserFile(value) ? value : null;
  }

  private extractFileArray(value: unknown): File[] {
    return Array.isArray(value) ? value.filter((item): item is File => this.isBrowserFile(item)) : [];
  }

  private isBrowserFile(value: unknown): value is File {
    return this.isBrowser && typeof File !== 'undefined' && value instanceof File;
  }

  private validateStep(stepIndex: number, markTouched: boolean): boolean {
    const group = [
      this.accountGroup,
      this.professionalGroup,
      this.expertiseGroup,
      this.documentsGroup,
      this.agreementsGroup,
    ][stepIndex];

    if (!group) {
      return false;
    }

    if (markTouched) {
      return this.formValidationService.validateForm(group, this.getFieldName, this.el);
    }

    return group.valid;
  }

  private getControl(path: string): AbstractControl | null {
    return this.registrationForm.get(path);
  }

  private getFieldName(field: string): string {
    const map: Record<string, string> = {
      email: 'Email',
      fullName: 'Full Name',
      mobileNumber: 'Mobile Number',
      gender: 'Gender',
      dob: 'Date of Birth',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      country: 'Country',
      preferredLanguage: 'Preferred Language',
      professionalHeadline: 'Professional Headline',
      bio: 'Bio',
      profilePhoto: 'Profile Photo',
      yearsOfExperience: 'Years of Experience',
      currentJobTitle: 'Current Job Title',
      currentOrganization: 'Current Organization',
      highestQualification: 'Highest Qualification',
      skills: 'Skills',
      teachingCategories: 'Teaching Categories',
      languagesYouCanTeach: 'Teaching Languages',
      governmentId: 'Government ID',
      resume: 'Resume',
      certifications: 'Certifications',
      linkedInUrl: 'LinkedIn URL',
      gitHubUrl: 'GitHub URL',
      youTubeUrl: 'YouTube URL',
      portfolioWebsite: 'Portfolio Website',
      acceptTerms: 'Terms and Conditions',
      acceptInstructorPolicy: 'Instructor Policy',
      verifyInformation: 'Information Verification',
    };

    return map[field] || field;
  }

  private hasMeaningfulValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return value !== null && value !== undefined && value !== false;
  }

  private basename(path: string | null | undefined): string {
    const normalized = `${path ?? ''}`.trim();
    if (!normalized) {
      return '';
    }

    return normalized.split('/').pop() || normalized;
  }

  private uploadControlPath(key: UploadKey): string {
    return key === 'profilePhoto' ? `professional.${key}` : `documents.${key}`;
  }

  private focusOtpInput(index: number): void {
    if (!this.isBrowser) {
      return;
    }

    this.otpInputs?.toArray()[index]?.nativeElement.focus();
  }

  private syncOtpDomInputs(): void {
    if (!this.isBrowser) {
      return;
    }

    this.otpInputs?.forEach((inputRef, index) => {
      inputRef.nativeElement.value = this.otpValues[index] ?? '';
    });
  }

  private resetOtpValues(): void {
    this.otpValues = ['', '', '', '', '', ''];
    this.syncOtpDomInputs();
  }

  private startOtpTimers(expiresIn: number, resendIn: number): void {
    this.clearOtpTimers();
    this.otpExpiresIn = expiresIn;
    this.resendIn = resendIn;

    this.otpExpiryInterval = setInterval(() => {
      this.otpExpiresIn = Math.max(this.otpExpiresIn - 1, 0);
      if (this.otpExpiresIn === 0 && this.otpExpiryInterval) {
        clearInterval(this.otpExpiryInterval);
        this.otpExpiryInterval = undefined;
      }
    }, 1000);

    this.resendInterval = setInterval(() => {
      this.resendIn = Math.max(this.resendIn - 1, 0);
      if (this.resendIn === 0 && this.resendInterval) {
        clearInterval(this.resendInterval);
        this.resendInterval = undefined;
      }
    }, 1000);
  }

  private clearOtpTimers(): void {
    if (this.otpExpiryInterval) {
      clearInterval(this.otpExpiryInterval);
      this.otpExpiryInterval = undefined;
    }

    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = undefined;
    }
  }

  private formatTimer(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  private defaultDobCalendarView(): Date {
    const today = new Date();

    return new Date(today.getFullYear() - 25, today.getMonth(), 1);
  }

  private buildDobYearOptions(): number[] {
    return Array.from({ length: 100 }, (_, index) => this.currentYear - 1 - index);
  }

  private syncDobCalendarView(): void {
    const selectedDate = this.parseIsoDate(`${this.accountGroup.get('dob')?.value ?? ''}`);
    this.dobCalendarView = selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : this.defaultDobCalendarView();
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;
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

  private async transitionToStage(stage: OnboardingStage): Promise<void> {
    await Promise.resolve();
    this.stage = stage;
    this.cdr.detectChanges();
  }

  private scrollToTop(): void {
    this.pageTop?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private scrollToForm(): void {
    const target = this.formCard?.nativeElement ?? this.journeyStart?.nativeElement ?? this.pageTop?.nativeElement;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private revokeProfilePreviewIfNeeded(url: string | null): void {
    if (
      !url ||
      !this.canUseObjectUrl ||
      /^https?:\/\//i.test(url) ||
      url.startsWith('data:') ||
      url.includes('/api/getAfile?path=')
    ) {
      return;
    }

    URL.revokeObjectURL(url);
  }

  private extractHttpError(error: unknown): string {
    const apiError = error as {
      error?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };

    return this.extractErrorMessage(
      apiError?.error?.message || 'Something went wrong. Please try again.',
      apiError?.error?.errors,
    );
  }

  private extractErrorMessage(message: string, errors?: Record<string, string[]>): string {
    const firstValidationMessage = errors
      ? Object.values(errors)
          .flat()
          .find((item): item is string => typeof item === 'string' && item.length > 0)
      : '';

    return firstValidationMessage || message;
  }
}

function selectionRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return Array.isArray(control.value) && control.value.length > 0
      ? null
      : { selectionRequired: true };
  };
}

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = `${control.get('password')?.value ?? ''}`.trim();
    const confirmPassword = `${control.get('confirmPassword')?.value ?? ''}`.trim();

    if (!password && !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { mismatch: true };
  };
}
