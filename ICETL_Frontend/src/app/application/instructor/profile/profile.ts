import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IDropdownSettings, NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { lastValueFrom, Subscription } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { UserProfile, UserProfileService } from '../../../commonServices/user-profile.service';
import {
  DropdownOption,
  InstructorDocumentRecord,
  InstructorProfile,
  SaveAccountInformationPayload,
  SaveDocumentsAndSocialLinksFormValue,
  SaveProfessionalInformationFormValue,
  SaveSkillsAndCategoriesPayload,
} from '../../../services/instructor-registration.model';
import { InstructorRegistrationService } from '../../../services/instructor-registration.service';

type InstructorUploadKey = 'profilePhoto' | 'governmentId' | 'resume' | 'certifications';
type DocumentDisplayItem = {
  id: string;
  name: string;
  url: string | null;
};

@Component({
  selector: 'app-instructor-profile',
  imports: [CommonModule, ReactiveFormsModule, NgMultiSelectDropDownModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit, OnDestroy {
  @ViewChild('profileFormStart') private profileFormStart?: ElementRef<HTMLElement>;

  private readonly fb = inject(UntypedFormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private profileSyncTimer: ReturnType<typeof setTimeout> | null = null;

  readonly defaultProfileImage = 'assets/images/team/avatar-2.jpg';
  readonly genderOptions = [
    { label: 'Male', value: '1' },
    { label: 'Female', value: '2' },
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

  userProfile: UserProfile | null = null;
  instructorProfile: InstructorProfile | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  profileImagePreview = '';
  coverImagePreview = '';
  profileImageFile: File | null = null;
  coverImageFile: File | null = null;

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: [{ value: '', disabled: true }],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    dob: ['', [Validators.required]],
    gender: ['', [Validators.required]],
    country: ['', [Validators.required, Validators.maxLength(100)]],
    preferredLanguage: ['', [Validators.required, Validators.maxLength(100)]],
    password: ['', [Validators.minLength(8)]],
    confirmPassword: [''],
    professionalHeadline: [
      '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(150)],
    ],
    bio: ['', [Validators.required, Validators.minLength(80), Validators.maxLength(2000)]],
    profilePhoto: [null, [fileRequiredValidator()]],
    yearsOfExperience: [null as number | null, [Validators.required, Validators.min(0), Validators.max(60)]],
    currentJobTitle: ['', [Validators.required, Validators.maxLength(150)]],
    currentOrganization: ['', [Validators.required, Validators.maxLength(150)]],
    highestQualification: ['', [Validators.required, Validators.maxLength(150)]],
    skills: [[], [selectionRequiredValidator()]],
    teachingCategories: [[], [selectionRequiredValidator()]],
    languagesYouCanTeach: [[], [selectionRequiredValidator()]],
    governmentId: [null, [fileRequiredValidator()]],
    resume: [null, [fileRequiredValidator()]],
    certifications: [[], [selectionRequiredValidator()]],
    linkedInUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
    gitHubUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
    youTubeUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
    portfolioWebsite: ['', Validators.pattern(/^https?:\/\/.+/i)],
  }, { validators: passwordMatchValidator() });

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly instructorRegistrationService: InstructorRegistrationService,
    private readonly alertHelper: AlertHelperService,
  ) {
    this.userProfile = this.userProfileService.currentProfile;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.userProfileService.profile$.subscribe((profile) => {
        this.scheduleProfileSync(profile);
      }),
    );
    setTimeout(() => {
      void this.loadPageData();
    });
  }

  ngOnDestroy(): void {
    this.clearProfileSyncTimer();
    this.subscriptions.unsubscribe();
  }

  get displayName(): string {
    return this.userProfile?.name?.trim() || this.instructorProfile?.user?.name?.trim() || 'Instructor';
  }

  get profileImageSrc(): string {
    return (
      this.profileImagePreview ||
      this.resolveDocumentUrl(this.getPersistedDocument('profilePhoto')) ||
      this.userProfile?.profileImgUrl ||
      this.defaultProfileImage
    );
  }

  get coverImageSrc(): string {
    return this.coverImagePreview || this.userProfile?.coverImgUrl || '';
  }

  async submitProfileUpdate(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    try {
      await this.saveProfileChanges();
      this.profileImageFile = null;
      this.coverImageFile = null;
      await this.loadPageData();
      void this.alertHelper.success('Instructor profile updated successfully');
    } catch (error) {
      this.errorMessage = this.getApiErrorMessage(error, 'Profile update failed');
    } finally {
      this.isSaving = false;
    }
  }

  onProfileFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.profileImageFile = file;

    this.profileForm.get('profilePhoto')?.setValue(file);
    this.profileForm.get('profilePhoto')?.markAsDirty();
    this.profileForm.get('profilePhoto')?.updateValueAndValidity();

    if (!file) {
      this.profileImagePreview =
        this.resolveDocumentUrl(this.getPersistedDocument('profilePhoto')) ||
        this.userProfile?.profileImgUrl ||
        '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.profileImagePreview = typeof reader.result === 'string' ? reader.result : '';
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  onCoverFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.coverImageFile = file;

    if (!file) {
      this.coverImagePreview = this.userProfile?.coverImgUrl || '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.coverImagePreview = typeof reader.result === 'string' ? reader.result : '';
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  onDocumentChange(event: Event, key: Exclude<InstructorUploadKey, 'profilePhoto'>): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const nextValue = key === 'certifications' ? files : files[0] ?? null;

    this.profileForm.get(key)?.setValue(nextValue);
    this.profileForm.get(key)?.markAsDirty();
    this.profileForm.get(key)?.updateValueAndValidity();
  }

  fileNames(key: InstructorUploadKey): string[] {
    const value = this.profileForm.get(key)?.value;

    if (value instanceof File) {
      return [value.name];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item instanceof File) {
            return item.name;
          }

          return this.documentName(item);
        })
        .filter((item): item is string => !!item);
    }

    if (value) {
      const fileName = this.documentName(value);
      return fileName ? [fileName] : [];
    }

    return [];
  }

  documentDisplayItems(key: InstructorUploadKey): DocumentDisplayItem[] {
    const value = this.profileForm.get(key)?.value;

    if (value instanceof File) {
      return [
        {
          id: `file-${key}-${value.name}-${value.size}`,
          name: value.name,
          url: null,
        },
      ];
    }

    if (Array.isArray(value)) {
      return value
        .map((item, index) => this.mapDocumentDisplayItem(key, item, index))
        .filter((item): item is DocumentDisplayItem => !!item);
    }

    const item = this.mapDocumentDisplayItem(key, value, 0);
    return item ? [item] : [];
  }

  downloadDocument(key: InstructorUploadKey, index = 0): void {
    const document = this.getPersistedDocuments(key)[index];
    const normalizedPath = this.normalizeInstructorDocumentPath(document?.filePath);

    if (!normalizedPath) {
      return;
    }

    this.subscriptions.add(
      this.userProfileService
        .downloadPrivateFile(normalizedPath, this.documentName(document) || 'document')
        .subscribe({
          error: (error) => {
            this.errorMessage = this.getApiErrorMessage(error, 'Unable to download file');
            this.cdr.detectChanges();
          },
        }),
    );
  }

  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;

    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }

    return true;
  }

  scrollToProfileForm(): void {
    this.profileFormStart?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  private async loadPageData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const [profileResponse, instructorResponse] = await Promise.all([
        lastValueFrom(this.userProfileService.getUserProfileData()),
        lastValueFrom(this.instructorRegistrationService.getInstructorProfile()),
      ]);

      if (!profileResponse.success || !profileResponse.data) {
        throw new Error(profileResponse.message || 'Unable to load user profile');
      }

      if (!instructorResponse.status || !instructorResponse.data?.instructor) {
        throw new Error(instructorResponse.message || 'Unable to load instructor profile');
      }

      this.applyUserProfile(profileResponse.data);
      this.applyInstructorProfile(instructorResponse.data.instructor);
    } catch (error) {
      this.errorMessage = this.getApiErrorMessage(error, 'Unable to load profile data');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private applyUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.profileForm.patchValue(
      {
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        dob: profile.dob || '',
        gender: profile.gender || '',
      },
      { emitEvent: false },
    );

    if (!this.coverImageFile) {
      this.coverImagePreview = profile.coverImgUrl || '';
    }
  }

  private applyInstructorProfile(profile: InstructorProfile): void {
    this.instructorProfile = profile;

    this.profileForm.patchValue(
      {
        country: profile.country || '',
        preferredLanguage: profile.preferredLanguage || '',
        password: '',
        confirmPassword: '',
        professionalHeadline: profile.headline || '',
        bio: profile.bio || '',
        profilePhoto:
          profile.documents.find((document) => document.documentType === 'profilePhoto') ?? null,
        yearsOfExperience: profile.experienceYears ?? null,
        currentJobTitle: profile.currentJobTitle || '',
        currentOrganization: profile.currentOrganization || '',
        highestQualification: profile.qualification || '',
        skills: this.mapValuesToOptions(profile.skills, this.skillOptions),
        teachingCategories: this.mapValuesToOptions(profile.categories, this.categoryOptions),
        languagesYouCanTeach: this.mapValuesToOptions(
          profile.languagesYouCanTeach,
          this.teachingLanguageOptions,
        ),
        governmentId:
          profile.documents.find((document) => document.documentType === 'governmentId') ?? null,
        resume: profile.documents.find((document) => document.documentType === 'resume') ?? null,
        certifications: profile.documents.filter(
          (document) => document.documentType === 'certification',
        ),
        linkedInUrl: profile.linkedinUrl || '',
        gitHubUrl: profile.githubUrl || '',
        youTubeUrl: profile.youtubeUrl || '',
        portfolioWebsite: profile.portfolioUrl || '',
      },
      { emitEvent: false },
    );

    if (!this.profileImageFile) {
      this.profileImagePreview = '';
    }
  }

  private async saveProfileChanges(): Promise<void> {
    const userProfileResponse = await lastValueFrom(
      this.userProfileService.updateUserProfileData(this.buildUserProfileFormData(false)),
    );

    if (!userProfileResponse.success) {
      throw new Error(userProfileResponse.message || 'Unable to save user profile');
    }

    const accountResponse = await lastValueFrom(
      this.instructorRegistrationService.saveAccountInformation(this.buildAccountPayload()),
    );
    if (!accountResponse.status) {
      throw new Error(accountResponse.message || 'Unable to save account information');
    }

    const professionalResponse = await lastValueFrom(
      this.instructorRegistrationService.saveProfessionalInformation(
        this.buildProfessionalPayload(),
      ),
    );
    if (!professionalResponse.status) {
      throw new Error(professionalResponse.message || 'Unable to save professional information');
    }

    const skillsResponse = await lastValueFrom(
      this.instructorRegistrationService.saveSkillsAndCategories(this.buildSkillsPayload()),
    );
    if (!skillsResponse.status) {
      throw new Error(skillsResponse.message || 'Unable to save skills and categories');
    }

    const documentsResponse = await lastValueFrom(
      this.instructorRegistrationService.saveDocumentsAndSocialLinks(this.buildDocumentsPayload()),
    );
    if (!documentsResponse.status) {
      throw new Error(documentsResponse.message || 'Unable to save documents and social links');
    }
  }

  private buildUserProfileFormData(includeProfileImage: boolean): FormData {
    const formValue = this.profileForm.getRawValue();
    const formData = new FormData();

    formData.append('name', formValue.name || '');
    formData.append('phone', formValue.phone || '');
    formData.append('dob', formValue.dob || '');
    formData.append('gender', formValue.gender || '');

    if (includeProfileImage && this.profileImageFile) {
      formData.append('profileImg', this.profileImageFile);
    }

    if (this.coverImageFile) {
      formData.append('coverImg', this.coverImageFile);
    }

    return formData;
  }

  private buildAccountPayload(): SaveAccountInformationPayload {
    return {
      fullName: `${this.profileForm.get('name')?.value ?? ''}`.trim(),
      mobileNumber: `${this.profileForm.get('phone')?.value ?? ''}`.trim(),
      gender: `${this.profileForm.get('gender')?.value ?? ''}`.trim(),
      dob: `${this.profileForm.get('dob')?.value ?? ''}`.trim(),
      password: `${this.profileForm.get('password')?.value ?? ''}`.trim() || undefined,
      confirmPassword: `${this.profileForm.get('confirmPassword')?.value ?? ''}`.trim() || undefined,
      country: `${this.profileForm.get('country')?.value ?? ''}`.trim(),
      preferredLanguage: `${this.profileForm.get('preferredLanguage')?.value ?? ''}`.trim(),
    };
  }

  private buildProfessionalPayload(): SaveProfessionalInformationFormValue {
    return {
      professionalHeadline: `${this.profileForm.get('professionalHeadline')?.value ?? ''}`.trim(),
      bio: `${this.profileForm.get('bio')?.value ?? ''}`.trim(),
      profilePhoto: this.extractSingleFile(this.profileForm.get('profilePhoto')?.value),
      yearsOfExperience: Number(this.profileForm.get('yearsOfExperience')?.value ?? 0),
      currentJobTitle: `${this.profileForm.get('currentJobTitle')?.value ?? ''}`.trim(),
      currentOrganization: `${this.profileForm.get('currentOrganization')?.value ?? ''}`.trim(),
      highestQualification: `${this.profileForm.get('highestQualification')?.value ?? ''}`.trim(),
    };
  }

  private buildSkillsPayload(): SaveSkillsAndCategoriesPayload {
    return {
      skills: this.selectedTextValues(this.profileForm.get('skills')?.value),
      teachingCategories: this.selectedTextValues(this.profileForm.get('teachingCategories')?.value),
      languagesYouCanTeach: this.selectedTextValues(
        this.profileForm.get('languagesYouCanTeach')?.value,
      ),
    };
  }

  private buildDocumentsPayload(): SaveDocumentsAndSocialLinksFormValue {
    return {
      governmentId: this.extractSingleFile(this.profileForm.get('governmentId')?.value),
      resume: this.extractSingleFile(this.profileForm.get('resume')?.value),
      certifications: this.extractFileArray(this.profileForm.get('certifications')?.value),
      linkedInUrl: `${this.profileForm.get('linkedInUrl')?.value ?? ''}`.trim() || undefined,
      gitHubUrl: `${this.profileForm.get('gitHubUrl')?.value ?? ''}`.trim() || undefined,
      youTubeUrl: `${this.profileForm.get('youTubeUrl')?.value ?? ''}`.trim() || undefined,
      portfolioWebsite:
        `${this.profileForm.get('portfolioWebsite')?.value ?? ''}`.trim() || undefined,
    };
  }

  private selectedTextValues(values: DropdownOption[] | null | undefined): string[] {
    return (values ?? []).map((item) => item.itemText);
  }

  private mapValuesToOptions(
    values: string[] | null | undefined,
    options: DropdownOption[],
  ): DropdownOption[] {
    const selected = new Set((values ?? []).map((value) => value.trim().toLowerCase()));

    return options.filter((option) => selected.has(option.itemText.trim().toLowerCase()));
  }

  private extractSingleFile(value: unknown): File | null {
    return value instanceof File ? value : null;
  }

  private extractFileArray(value: unknown): File[] {
    return Array.isArray(value) ? value.filter((file): file is File => file instanceof File) : [];
  }

  private documentName(value: unknown): string | null {
    const document = value as InstructorDocumentRecord | null;

    if (!document) {
      return null;
    }

    return document.originalName || document.fileName || document.filePath?.split('/').pop() || null;
  }

  private getPersistedDocument(key: InstructorUploadKey): InstructorDocumentRecord | null {
    return this.getPersistedDocuments(key)[0] ?? null;
  }

  private getPersistedDocuments(key: InstructorUploadKey): InstructorDocumentRecord[] {
    const value = this.profileForm.get(key)?.value;
    const values = Array.isArray(value) ? value : value ? [value] : [];

    return values.filter((item): item is InstructorDocumentRecord => this.isInstructorDocumentRecord(item));
  }

  private mapDocumentDisplayItem(
    key: InstructorUploadKey,
    value: unknown,
    index: number,
  ): DocumentDisplayItem | null {
    if (value instanceof File) {
      return {
        id: `file-${key}-${index}-${value.name}-${value.size}`,
        name: value.name,
        url: null,
      };
    }

    const name = this.documentName(value);
    if (!name) {
      return null;
    }

    const document = value as InstructorDocumentRecord;

    return {
      id: `document-${key}-${document.id ?? index}`,
      name,
      url: this.resolveDocumentUrl(document),
    };
  }

  private resolveDocumentUrl(value: unknown): string | null {
    const document = this.isInstructorDocumentRecord(value) ? value : null;
    const rawUrls = [`${document?.fileUrl ?? ''}`.trim(), `${document?.filePath ?? ''}`.trim()].filter(Boolean);

    for (const rawUrl of rawUrls) {
      if (rawUrl.includes('/public/uploads/instructors/')) {
        return this.buildInstructorDocumentUrl(document?.filePath ?? this.extractInstructorDocumentPath(rawUrl));
      }

      if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl;
      }

      return this.buildInstructorDocumentUrl(rawUrl);
    }

    return null;
  }

  private buildInstructorDocumentUrl(path: string | null | undefined): string | null {
    const normalizedPath = this.normalizeInstructorDocumentPath(path);

    if (!normalizedPath) {
      return null;
    }

    return this.userProfileService.buildPrivateFileUrl(normalizedPath);
  }

  private extractInstructorDocumentPath(rawUrl: string): string {
    const marker = '/public/uploads/instructors/';
    const markerIndex = rawUrl.indexOf(marker);

    return markerIndex >= 0 ? rawUrl.slice(markerIndex + marker.length) : rawUrl;
  }

  private isInstructorDocumentRecord(value: unknown): value is InstructorDocumentRecord {
    return !!value && typeof value === 'object' && 'filePath' in value && 'documentType' in value;
  }

  private normalizeInstructorDocumentPath(path: string | null | undefined): string | null {
    const rawPath = `${path ?? ''}`.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    if (!rawPath) {
      return null;
    }

    return rawPath.startsWith('uploads/instructors/')
      ? rawPath
      : `uploads/instructors/${rawPath}`;
  }

  private scheduleProfileSync(profile: UserProfile | null): void {
    this.clearProfileSyncTimer();

    this.profileSyncTimer = setTimeout(() => {
      this.userProfile = profile;

      if (profile) {
        this.applyUserProfile(profile);
      }

      this.cdr.detectChanges();
    });
  }

  private clearProfileSyncTimer(): void {
    if (this.profileSyncTimer) {
      clearTimeout(this.profileSyncTimer);
      this.profileSyncTimer = null;
    }
  }

  private getApiErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

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

function selectionRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return Array.isArray(control.value) && control.value.length > 0
      ? null
      : { selectionRequired: true };
  };
}

function fileRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value instanceof File) {
      return null;
    }

    if (Array.isArray(control.value)) {
      return control.value.length > 0 ? null : { fileRequired: true };
    }

    return control.value ? null : { fileRequired: true };
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
