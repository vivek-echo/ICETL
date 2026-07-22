import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../layout/header/header';
import { FooterComponent } from '../layout/footer/footer';
import { Subscription } from 'rxjs';
import { AlertHelperService } from '../commonServices/alert-helper-service';
import { UserProfile, UserProfileService } from '../commonServices/user-profile.service';
import { SideNav } from './side-nav/side-nav';
import { AuthService } from '../commonServices/auth.service';
import { ProfileModalService } from '../commonServices/profile-modal.service';
import { FormValidationService } from '../commonServices/form-validation-service';
import { FormValidationRules } from '../commonServices/form-validation-rules';
import { ContactEnquiryService } from '../commonServices/contact-enquiry.service';
import { canAccessApplicationRoute } from '../commonServices/auth-navigation';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../shared/modal-window';

@Component({
  selector: 'app-application',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    SideNav,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './application.html',
  styleUrl: './application.scss',
})
export class Application implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly el = inject(ElementRef);
  private readonly formValidationService = inject(FormValidationService);
  private profileSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private hasCheckedEnquiryAlert = false;
  private readonly sidebarPreferenceKey = 'icetl.sidebar.collapsed';

  readonly defaultProfileImage = 'assets/images/team/avatar-2.jpg';
  readonly enquiriesRoute = '/application/enquiries';
  readonly genderOptions = [
    { label: 'Male', value: '1' },
    { label: 'Female', value: '2' },
    { label: 'Others', value: '3' },
  ];
  private readonly allowedProfileImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxProfileImageBytes = 4 * 1024 * 1024;
  private readonly maxCoverImageBytes = 6 * 1024 * 1024;

  userProfile: UserProfile | null = null;
  isProfileModalOpen = false;
  isSavingProfile = false;
  profileImagePreview = '';
  coverImagePreview = '';
  profileImageFile: File | null = null;
  coverImageFile: File | null = null;
  profileErrorMessage = '';
  isSidebarCollapsed = false;

  readonly profileForm = this.fb.group({
    name: ['', FormValidationRules.requiredName()],
    email: [{ value: '', disabled: true }],
    phone: ['', FormValidationRules.requiredMobile()],
    dob: ['', [Validators.required, this.dateBeforeTodayValidator]],
    gender: ['', [Validators.required, Validators.pattern(/^[123]$/)]],
  });

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly alertHelper: AlertHelperService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly profileModalService: ProfileModalService,
    private readonly contactEnquiryService: ContactEnquiryService,
  ) {
    this.userProfile = this.userProfileService.currentProfile;
  }

  ngOnInit(): void {
    this.loadSidebarPreference();

    this.subscriptions.add(
      this.userProfileService.profile$.subscribe((profile) => {
        this.scheduleProfileSync(profile);
      }),
    );

    this.subscriptions.add(
      this.profileModalService.openModal$.subscribe(() => {
        this.openProfileSettings();
      }),
    );

    this.checkForNewEnquiries();
  }

  ngOnDestroy(): void {
    this.clearProfileSyncTimer();
    this.subscriptions.unsubscribe();
  }

  get profileImageSrc(): string {
    return this.userProfile?.profileImgUrl || this.defaultProfileImage;
  }

  get thumbnailImageSrc(): string {
    return this.userProfile?.thumbnailImgUrl || this.defaultProfileImage;
  }

  get coverImageSrc(): string {
    return this.userProfile?.coverImgUrl || '';
  }

  get displayName(): string {
    return this.userProfile?.name?.trim() || 'Learner';
  }

  get canManageEnquiries(): boolean {
    return this.canAccessRoute(this.enquiriesRoute);
  }

  openProfileSettings(event?: Event): void {
    event?.preventDefault();

   

    this.openUpdateProfileModal();
  }

  toggleSidebar(event?: Event): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.saveSidebarPreference();

    if (this.isSidebarCollapsed) {
      (event?.currentTarget as HTMLElement | null)?.blur();
    }
  }

  canAccessRoute(route: string): boolean {
    return canAccessApplicationRoute(this.authService.getUser(), route, false);
  }

  openUpdateProfileModal(): void {
    this.profileErrorMessage = '';
    this.profileImageFile = null;
    this.coverImageFile = null;
    this.profileImagePreview = this.profileImageSrc;
    this.coverImagePreview = this.coverImageSrc;

    if (this.userProfile) {
      this.populateProfileForm(this.userProfile);
    }

    this.isProfileModalOpen = true;

    this.subscriptions.add(
      this.userProfileService.getUserProfileData().subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.profileErrorMessage = response.message || 'Unable to load latest profile data';
            return;
          }

          this.populateProfileForm(response.data);
          this.profileImagePreview = this.profileImageSrc;
          this.coverImagePreview = this.coverImageSrc;
        },
        error: (error) => {
          this.profileErrorMessage = this.getApiErrorMessage(
            error,
            'Unable to load latest profile data',
          );
        },
      }),
    );
  }

  closeUpdateProfileModal(): void {
    if (this.isSavingProfile) {
      return;
    }

    this.isProfileModalOpen = false;
    this.profileErrorMessage = '';
  }

  onProfileFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.profileImageFile = file;

    if (!file) {
      return;
    }

    const validationMessage = this.validateProfileImageFile(
      file,
      'Profile image',
      this.maxProfileImageBytes,
    );

    if (validationMessage) {
      this.profileImageFile = null;
      input.value = '';
      this.profileErrorMessage = validationMessage;
      return;
    }

    this.profileErrorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      const preview = typeof reader.result === 'string' ? reader.result : '';

      this.profileImagePreview = preview;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  onCoverFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.coverImageFile = file;

    if (!file) {
      return;
    }

    const validationMessage = this.validateProfileImageFile(
      file,
      'Cover image',
      this.maxCoverImageBytes,
    );

    if (validationMessage) {
      this.coverImageFile = null;
      input.value = '';
      this.profileErrorMessage = validationMessage;
      return;
    }

    this.profileErrorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      const preview = typeof reader.result === 'string' ? reader.result : '';

      this.coverImagePreview = preview;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  submitProfileUpdate(): void {
    if (!this.formValidationService.validateForm(this.profileForm, this.getFieldName, this.el)) {
      return;
    }

    const formValue = this.profileForm.getRawValue();
    const formData = new FormData();
    formData.append('name', formValue.name || '');
    formData.append('phone', formValue.phone || '');
    formData.append('dob', formValue.dob || '');
    formData.append('gender', formValue.gender || '');

    if (this.profileImageFile) {
      formData.append('profileImg', this.profileImageFile);
    }

    if (this.coverImageFile) {
      formData.append('coverImg', this.coverImageFile);
    }

    this.isSavingProfile = true;
    this.profileErrorMessage = '';

    this.userProfileService.updateUserProfileData(formData).subscribe({
      next: (response) => {
        this.isSavingProfile = false;

        if (response.success && response.data) {
          this.isProfileModalOpen = false;
          void this.alertHelper.success('Profile updated successfully');
          return;
        }

        this.profileErrorMessage = response.message || 'Profile update failed';
      },
      error: (error) => {
        this.isSavingProfile = false;
        this.profileErrorMessage = this.getApiErrorMessage(error, 'Profile update failed');
      },
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

  private populateProfileForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      dob: profile.dob || '',
      gender: profile.gender || '',
    });
  }

  private getFieldName(field: string): string {
    const map: Record<string, string> = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      dob: 'Date of Birth',
      gender: 'Gender',
    };

    return map[field] || field;
  }

  private dateBeforeTodayValidator(control: AbstractControl): ValidationErrors | null {
    const value = `${control.value ?? ''}`.trim();

    if (!value) {
      return null;
    }

    const selectedDate = new Date(value);

    if (Number.isNaN(selectedDate.getTime())) {
      return { dateBeforeToday: true };
    }

    selectedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selectedDate < today ? null : { dateBeforeToday: true };
  }

  private validateProfileImageFile(file: File, label: string, maxBytes: number): string {
    if (!this.allowedProfileImageTypes.includes(file.type)) {
      return `${label} must be a PNG, JPG, or WEBP image.`;
    }

    if (file.size > maxBytes) {
      return `${label} must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`;
    }

    return '';
  }

  private loadSidebarPreference(): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    try {
      this.isSidebarCollapsed = localStorage.getItem(this.sidebarPreferenceKey) === 'true';
    } catch {
      this.isSidebarCollapsed = false;
    }
  }

  private saveSidebarPreference(): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    try {
      localStorage.setItem(this.sidebarPreferenceKey, `${this.isSidebarCollapsed}`);
    } catch {
      // Ignore storage failures so navigation remains usable.
    }
  }

  private canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private scheduleProfileSync(profile: UserProfile | null): void {
    this.clearProfileSyncTimer();

    this.profileSyncTimer = setTimeout(() => {
      this.userProfile = profile;

      if (profile && !this.isProfileModalOpen) {
        this.populateProfileForm(profile);
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

  private checkForNewEnquiries(): void {
    if (this.hasCheckedEnquiryAlert || !this.canManageEnquiries) {
      return;
    }

    this.hasCheckedEnquiryAlert = true;

    this.subscriptions.add(
      this.contactEnquiryService.getUnreadCount().subscribe({
        next: (response) => {
          const unreadCount = Number(response.data?.unreadCount ?? 0);

          if (!response.status || unreadCount <= 0) {
            return;
          }

          const message =
            unreadCount === 1
              ? 'There is 1 new enquiry waiting for review.'
              : `There are ${unreadCount} new enquiries waiting for review.`;

          void this.alertHelper
            .confirm(message, 'New Enquiry', 'See enquiries', 'OK', 'info')
            .then((seeEnquiries) => {
              if (seeEnquiries) {
                void this.router.navigate([this.enquiriesRoute]);
              }
            });
        },
        error: () => {
          this.hasCheckedEnquiryAlert = false;
        },
      }),
    );
  }

  async logoutUser(event: Event): Promise<void> {
    event.preventDefault();

    const shouldLogout = await this.alertHelper.confirm(
      'You will be signed out of your account.',
      'Confirm logout',
    );

    if (!shouldLogout) return;

    this.authService.logout().subscribe({
      next: () => {
        this.handleLogoutSuccess();
      },
      error: () => {
        this.handleLogoutSuccess();
      },
    });
  }

  private handleLogoutSuccess(): void {
    this.userProfileService.clearProfile();
    this.userProfile = null;
    this.authService.logoutLocally(false);

    this.router.navigate(['/login']);
  }
}
