import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';
import {
  AdministrationService,
  AdminBankVerificationStatus,
  Branch,
  EmployeeListMeta,
  EmployeeListSummary,
  EmployeeUser,
  InstructorAdminDetails,
  InstructorAdminDocument,
  InstructorPayoutSummary,
  LocationDistrict,
  LocationState,
  RoleOption,
} from '../../services/administration';

interface InstructorDetailItem {
  label: string;
  value: string | number | null | undefined;
}

interface InstructorSocialLink {
  label: string;
  icon: string;
  url: string;
}

@Component({
  selector: 'app-view-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './view-users.html',
  styleUrl: './view-users.scss',
})
export class ViewUsers implements OnInit {
  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  readonly perPageOptions = [10, 20, 50, 100];
  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: '1' },
    { label: 'Inactive', value: '0' },
  ];

  users: EmployeeUser[] = [];
  roles: RoleOption[] = [];
  states: LocationState[] = [];
  districts: LocationDistrict[] = [];
  branches: Branch[] = [];

  loading = false;
  loadingRoles = false;
  loadingStates = false;
  loadingDistricts = false;
  loadingBranches = false;
  loadingInstructorDetails = false;
  apiError = '';
  instructorDetailsError = '';
  showFilters = false;
  resettingUserId: number | null = null;
  statusUpdatingUserId: number | null = null;
  bankVerificationUpdatingStatus: AdminBankVerificationStatus | null = null;
  payoutInitiatingUserId: number | null = null;
  selectedInstructorUser: EmployeeUser | null = null;
  selectedInstructorDetails: InstructorAdminDetails | null = null;

  filters = {
    search: '',
    stateCode: '',
    districtCode: '',
    branchId: '',
    role: 'all',
    status: 'all',
  };

  meta: EmployeeListMeta = this.createEmptyMeta();
  summary: EmployeeListSummary = this.createEmptySummary();

  constructor(
    private readonly administrationService: AdministrationService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadRoles();
    void this.loadStates();
    void this.loadUsers();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  async loadRoles(): Promise<void> {
    this.loadingRoles = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getRoles());
      this.roles = response.status ? response.data : [];
    } catch (error: any) {
      this.roles = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load roles. Please try again.',
        'User Filters',
      );
    } finally {
      this.loadingRoles = false;
      this.cdr.detectChanges();
    }
  }

  async loadStates(): Promise<void> {
    this.loadingStates = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getStates());
      this.states = response.status ? response.data : [];
    } catch (error: any) {
      this.states = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load states. Please try again.',
        'User Filters',
      );
    } finally {
      this.loadingStates = false;
      this.cdr.detectChanges();
    }
  }

  onFilterStateChange(): void {
    const stateCode = Number(this.filters.stateCode || 0);

    this.filters.districtCode = '';
    this.filters.branchId = '';
    this.districts = [];
    this.branches = [];

    if (!stateCode) {
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();
    void this.loadDistricts(stateCode);
  }

  async loadDistricts(stateCode: number): Promise<void> {
    this.loadingDistricts = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getDistricts(stateCode));
      this.districts = response.status ? response.data : [];
    } catch (error: any) {
      this.districts = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load districts/cities. Please try again.',
        'User Filters',
      );
    } finally {
      this.loadingDistricts = false;
      this.cdr.detectChanges();
    }
  }

  onFilterDistrictChange(): void {
    const stateCode = Number(this.filters.stateCode || 0);
    const districtCode = Number(this.filters.districtCode || 0);

    this.filters.branchId = '';
    this.branches = [];

    if (!stateCode || !districtCode) {
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();
    void this.loadBranches(stateCode, districtCode);
  }

  async loadBranches(stateCode: number, districtCode: number): Promise<void> {
    this.loadingBranches = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.getBranches({
          page: 1,
          perPage: 'all',
          stateCode,
          districtCode,
          status: 'all',
        }),
      );
      this.branches = response.status ? response.data : [];
    } catch (error: any) {
      this.branches = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load branches. Please try again.',
        'User Filters',
      );
    } finally {
      this.loadingBranches = false;
      this.cdr.detectChanges();
    }
  }

  async loadUsers(page = this.meta.currentPage): Promise<void> {
    this.loading = true;
    this.apiError = '';
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.getEmployeeUsers({
          page,
          perPage: this.meta.perPage,
          search: this.filters.search.trim(),
          stateCode: this.filters.stateCode,
          districtCode: this.filters.districtCode,
          branchId: this.filters.branchId,
          role: this.filters.role,
          status: this.filters.status,
        }),
      );

      if (response.status || response.success) {
        this.users = response.data ?? [];
        this.meta = response.meta ?? this.createEmptyMeta();
        this.summary = response.summary ?? this.createEmptySummary();

        if (this.users.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadUsers(this.meta.currentPage - 1);
        }
      } else {
        this.users = [];
        this.meta = this.createEmptyMeta();
        this.summary = this.createEmptySummary();
        this.apiError = response.message || 'Unable to fetch users.';
      }
    } catch (error: any) {
      this.users = [];
      this.meta = this.createEmptyMeta();
      this.summary = this.createEmptySummary();
      this.apiError = error?.error?.message || 'Unable to fetch users.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilters(): void {
    void this.loadUsers(1);
  }

  resetFilters(): void {
    this.filters = {
      search: '',
      stateCode: '',
      districtCode: '',
      branchId: '',
      role: 'all',
      status: 'all',
    };
    this.districts = [];
    this.branches = [];
    void this.loadUsers(1);
  }

  onPerPageChange(): void {
    void this.loadUsers(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.meta.lastPage || page === this.meta.currentPage) {
      return;
    }

    void this.loadUsers(page);
  }

  async resetPassword(user: EmployeeUser): Promise<void> {
    const confirmed = await this.alertHelper.confirm(
      `Reset password for ${user.name} to ICETL@123?`,
      'Reset Password',
      'Reset',
      'Cancel',
      'warning',
    );

    if (!confirmed) {
      return;
    }

    this.resettingUserId = user.id;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.resetEmployeePassword(user.id));

      if (response.status || response.success) {
        await this.alertHelper.success(
          `Password reset to ${response.data?.defaultPassword || 'ICETL@123'}.`,
          'Password Reset',
        );
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to reset password. Please try again.',
        'Password Reset',
      );
    } finally {
      this.resettingUserId = null;
      this.cdr.detectChanges();
    }
  }

  async toggleUserStatus(user: EmployeeUser): Promise<void> {
    const nextStatus = this.isActive(user) ? 0 : 1;
    const actionLabel = nextStatus === 1 ? 'Activate' : 'Deactivate';
    const confirmed = await this.alertHelper.confirm(
      `${actionLabel} ${user.name}?`,
      `${actionLabel} User`,
      actionLabel,
      'Cancel',
      nextStatus === 1 ? 'question' : 'warning',
    );

    if (!confirmed) {
      return;
    }

    this.statusUpdatingUserId = user.id;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.updateEmployeeStatus(user.id, nextStatus),
      );

      if (response.status || response.success) {
        await this.alertHelper.success(response.message || `${actionLabel}d successfully`, `${actionLabel} User`);
        await this.loadUsers(this.meta.currentPage);
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to update user status. Please try again.',
        `${actionLabel} User`,
      );
    } finally {
      this.statusUpdatingUserId = null;
      this.cdr.detectChanges();
    }
  }

  async openInstructorDetails(user: EmployeeUser): Promise<void> {
    if (!this.isInstructor(user)) {
      return;
    }

    this.selectedInstructorUser = user;
    this.selectedInstructorDetails = null;
    this.instructorDetailsError = '';
    this.loadingInstructorDetails = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getInstructorDetails(user.id));

      if (response.status || response.success) {
        this.selectedInstructorDetails = response.data;
        this.syncInstructorPayoutSummary(user.id, response.data?.payoutSummary ?? null);
      } else {
        this.instructorDetailsError = response.message || 'Unable to load instructor details.';
      }
    } catch (error: any) {
      this.instructorDetailsError = error?.error?.message || 'Unable to load instructor details.';
    } finally {
      this.loadingInstructorDetails = false;
      this.cdr.detectChanges();
    }
  }

  closeInstructorDetails(): void {
    this.selectedInstructorUser = null;
    this.selectedInstructorDetails = null;
    this.loadingInstructorDetails = false;
    this.instructorDetailsError = '';
    this.bankVerificationUpdatingStatus = null;
  }

  trackByUserId(_: number, user: EmployeeUser): number {
    return user.id;
  }

  isActive(user: EmployeeUser): boolean {
    return Number(user.status) === 1;
  }

  isActionBusy(user: EmployeeUser): boolean {
    return this.resettingUserId === user.id || this.statusUpdatingUserId === user.id;
  }

  isInstructor(user: EmployeeUser | null | undefined): boolean {
    if (!user) {
      return false;
    }

    const roleName = `${user.roleName || ''}`.toLowerCase();

    return Number(user.role) === 3 || roleName.includes('instructor');
  }

  isInstructorDetailBusy(user: EmployeeUser): boolean {
    return this.loadingInstructorDetails && this.selectedInstructorUser?.id === user.id;
  }

  isPayoutBusy(user: EmployeeUser | { id: number }): boolean {
    return this.payoutInitiatingUserId === user.id;
  }

  isBankVerificationBusy(status?: AdminBankVerificationStatus): boolean {
    return status
      ? this.bankVerificationUpdatingStatus === status
      : this.bankVerificationUpdatingStatus !== null;
  }

  instructorPayoutAmount(user: EmployeeUser): number {
    return Number(user.instructorPayout?.eligiblePayoutAmount) || 0;
  }

  hasInstructorPayoutAmount(user: EmployeeUser): boolean {
    return this.isInstructor(user) && this.instructorPayoutAmount(user) > 0;
  }

  payoutSummaryForDetails(details: InstructorAdminDetails): InstructorPayoutSummary | null {
    return details.payoutSummary ?? this.selectedInstructorUser?.instructorPayout ?? null;
  }

  payoutButtonTitle(user: EmployeeUser): string {
    if (!this.hasInstructorPayoutAmount(user)) {
      return 'No payable instructor amount';
    }

    if (!user.instructorPayout?.bankVerified) {
      return 'Verify bank account before payout';
    }

    return 'Initiate instructor bank payment';
  }

  getSerialNumber(index: number): number {
    return (this.meta.currentPage - 1) * Number(this.meta.perPage || 10) + index + 1;
  }

  get resultStart(): number {
    return this.meta.from ?? 0;
  }

  get resultEnd(): number {
    return this.meta.to ?? 0;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value.replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatGender(value: string | number | null | undefined): string {
    const labels: Record<string, string> = {
      '1': 'Male',
      '2': 'Female',
      '3': 'Other',
    };

    return labels[`${value ?? ''}`] || 'N/A';
  }

  formatRole(user: EmployeeUser): string {
    return user.roleName || (user.role ? `Role ${user.role}` : 'N/A');
  }

  formatValue(value: string | number | null | undefined): string {
    const normalizedValue = `${value ?? ''}`.trim();

    return normalizedValue || 'N/A';
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
  }

  formatBoolean(value: boolean | null | undefined): string {
    return value ? 'Yes' : 'No';
  }

  formatApprovalStatus(value: string | null | undefined): string {
    const normalizedValue = `${value ?? ''}`.trim();

    if (!normalizedValue) {
      return 'Draft';
    }

    return normalizedValue
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  formatBankVerificationStatus(value: string | null | undefined): string {
    const normalizedValue = this.formatApprovalStatus(value);

    return normalizedValue === 'Draft' ? 'Not Submitted' : normalizedValue;
  }

  isBankVerified(value: string | null | undefined): boolean {
    return this.formatBankVerificationStatus(value).toLowerCase() === 'verified';
  }

  isBankRejected(value: string | null | undefined): boolean {
    const status = this.formatBankVerificationStatus(value).toLowerCase();

    return status === 'rejected' || status === 'not submitted';
  }

  hasSubmittedBankDetails(details: InstructorAdminDetails): boolean {
    const profile = details.profile;

    if (!profile) {
      return false;
    }

    return [
      profile.bankAccountHolderName,
      profile.bankName,
      profile.bankAccountNumber,
      profile.bankIfscCode,
      profile.bankAccountType,
      profile.bankBranchName,
    ].every((value) => `${value ?? ''}`.trim() !== '');
  }

  canInitiateBankVerification(details: InstructorAdminDetails): boolean {
    const status = this.formatBankVerificationStatus(details.profile?.bankVerificationStatus);

    return this.hasSubmittedBankDetails(details) && ['Not Submitted', 'Rejected'].includes(status);
  }

  canResolveBankVerification(details: InstructorAdminDetails): boolean {
    return this.hasSubmittedBankDetails(details)
      && this.formatBankVerificationStatus(details.profile?.bankVerificationStatus) === 'Pending';
  }

  async updateBankVerificationStatus(
    details: InstructorAdminDetails,
    nextStatus: AdminBankVerificationStatus,
  ): Promise<void> {
    if (!details.profile || !this.hasSubmittedBankDetails(details) || this.isBankVerificationBusy()) {
      return;
    }

    const actionLabel = this.bankVerificationActionLabel(nextStatus);
    const confirmed = await this.alertHelper.confirm(
      `${actionLabel} for ${details.user.name}?`,
      'Bank Verification',
      actionLabel,
      'Cancel',
      nextStatus === 'Rejected' ? 'warning' : 'question',
    );

    if (!confirmed) {
      return;
    }

    this.bankVerificationUpdatingStatus = nextStatus;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.updateInstructorBankVerificationStatus(details.user.id, nextStatus),
      );

      if (response.status || response.success) {
        this.selectedInstructorDetails = response.data;
        this.syncInstructorPayoutSummary(details.user.id, response.data?.payoutSummary ?? null);
        await this.alertHelper.success(
          response.message || 'Bank verification status updated successfully.',
          'Bank Verification',
        );
      }
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to update bank verification status. Please try again.',
        'Bank Verification',
      );
    } finally {
      this.bankVerificationUpdatingStatus = null;
      this.cdr.detectChanges();
    }
  }

  async initiateInstructorPayout(
    user: EmployeeUser,
    summary: InstructorPayoutSummary | null | undefined = user.instructorPayout,
  ): Promise<void> {
    if (!this.isInstructor(user) || this.isPayoutBusy(user)) {
      return;
    }

    const payoutSummary = summary ?? user.instructorPayout ?? null;
    const payoutAmount = Number(payoutSummary?.eligiblePayoutAmount) || 0;

    if (payoutAmount <= 0) {
      await this.alertHelper.info('There is no payable instructor amount right now.', 'Instructor Payout');
      return;
    }

    if (!payoutSummary?.bankVerified) {
      await this.alertHelper.warning(
        'Instructor bank account must be verified before payment can be initiated.',
        'Bank Verification Required',
      );
      await this.openInstructorDetails(user);
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Initiate bank payment of Rs. ${this.formatAmount(payoutAmount)} to ${user.name}?`,
      'Instructor Payout',
      'Initiate Payment',
      'Cancel',
      'question',
    );

    if (!confirmed) {
      return;
    }

    this.payoutInitiatingUserId = user.id;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.initiateInstructorPayout(user.id));

      if (response.status || response.success) {
        const payout = response.data?.payout;
        const nextSummary = response.data?.summary ?? null;

        this.syncInstructorPayoutSummary(user.id, nextSummary);

        if (this.selectedInstructorUser?.id === user.id && response.data?.instructorDetails) {
          this.selectedInstructorDetails = response.data.instructorDetails;
        }

        await this.alertHelper.success(
          `Payment initiated successfully. Invoice: ${payout?.invoiceNumber || 'generated'}.`,
          'Instructor Payout',
        );
      }
    } catch (error: any) {
      const message = error?.error?.message || 'Unable to initiate instructor payment. Please try again.';

      if (error?.status === 422) {
        await this.alertHelper.warning(message, 'Instructor Payout');
        await this.openInstructorDetails(user);
      } else {
        await this.alertHelper.error(message, 'Instructor Payout');
      }
    } finally {
      this.payoutInitiatingUserId = null;
      this.cdr.detectChanges();
    }
  }

  documentLabel(documentType: string | null | undefined): string {
    const labels: Record<string, string> = {
      profilePhoto: 'Profile Photo',
      governmentId: 'Government ID',
      resume: 'Resume',
      certification: 'Certification',
      certifications: 'Certification',
    };

    const key = `${documentType ?? ''}`.trim();

    return labels[key] || this.formatApprovalStatus(key || 'Document');
  }

  documentIcon(document: InstructorAdminDocument): string {
    const fileName = `${document.fileName || document.filePath || ''}`.toLowerCase();

    if (/\.(png|jpe?g|webp|gif)$/.test(fileName)) {
      return 'fa-regular fa-image';
    }

    if (fileName.endsWith('.pdf')) {
      return 'fa-regular fa-file-pdf';
    }

    if (/\.(doc|docx)$/.test(fileName)) {
      return 'fa-regular fa-file-word';
    }

    return 'fa-regular fa-file-lines';
  }

  trackByDocumentId(_: number, document: InstructorAdminDocument): number {
    return document.id;
  }

  accountDetailItems(details: InstructorAdminDetails): InstructorDetailItem[] {
    const user = details.user;

    return [
      { label: 'User ID', value: user.id },
      { label: 'Code', value: user.code },
      { label: 'Name', value: user.name },
      { label: 'Email', value: user.email },
      { label: 'Phone', value: user.phone },
      { label: 'Gender', value: this.formatGender(user.gender) },
      { label: 'Date of Birth', value: this.formatDate(user.dob) },
      { label: 'Email Verified', value: this.formatDate(user.emailVerifiedAt) },
      { label: 'Profile Stage', value: user.profileStage },
      { label: 'Created Date', value: this.formatDate(user.createdAt) },
      { label: 'Updated Date', value: this.formatDate(user.updatedAt) },
    ];
  }

  professionalDetailItems(details: InstructorAdminDetails): InstructorDetailItem[] {
    const profile = details.profile;

    return [
      { label: 'Headline', value: profile?.headline },
      { label: 'Current Job Title', value: profile?.currentJobTitle },
      { label: 'Current Organization', value: profile?.currentOrganization },
      { label: 'Highest Qualification', value: profile?.qualification },
      { label: 'Experience', value: profile?.experienceYears !== null && profile?.experienceYears !== undefined ? `${profile.experienceYears} year${profile.experienceYears === 1 ? '' : 's'}` : null },
      { label: 'Country', value: profile?.country },
      { label: 'Preferred Language', value: profile?.preferredLanguage },
    ];
  }

  onboardingDetailItems(details: InstructorAdminDetails): InstructorDetailItem[] {
    const profile = details.profile;

    return [
      { label: 'Approval Status', value: this.formatApprovalStatus(profile?.approvalStatus) },
      { label: 'Instructor Status', value: profile?.statusLabel },
      { label: 'Onboarding Step', value: profile?.onboardingStep ? `${profile.onboardingStep} / 6` : null },
      { label: 'Onboarding Completed', value: this.formatBoolean(profile?.onboardingCompleted) },
      { label: 'Profile Created', value: this.formatDate(profile?.createdAt) },
      { label: 'Profile Updated', value: this.formatDate(profile?.updatedAt) },
    ];
  }

  bankSettlementDetailItems(details: InstructorAdminDetails): InstructorDetailItem[] {
    const profile = details.profile;

    return [
      { label: 'Account Holder Name', value: profile?.bankAccountHolderName },
      { label: 'Bank Name', value: profile?.bankName },
      { label: 'Account Number', value: profile?.bankAccountNumber },
      { label: 'IFSC Code', value: profile?.bankIfscCode },
      { label: 'Account Type', value: profile?.bankAccountType },
      { label: 'Bank Branch Name', value: profile?.bankBranchName },
      {
        label: 'Bank Verification Status',
        value: this.formatBankVerificationStatus(profile?.bankVerificationStatus),
      },
    ];
  }

  private bankVerificationActionLabel(status: AdminBankVerificationStatus): string {
    const labels: Record<AdminBankVerificationStatus, string> = {
      Pending: 'Initiate Verification',
      Verified: 'Mark Verified',
      Rejected: 'Reject Details',
    };

    return labels[status];
  }

  locationDetailItems(details: InstructorAdminDetails): InstructorDetailItem[] {
    const user = details.user;

    return [
      { label: 'State', value: user.stateName },
      { label: 'District/City', value: user.districtName },
      { label: 'Branch', value: user.branchName },
    ];
  }

  socialLinks(details: InstructorAdminDetails): InstructorSocialLink[] {
    const profile = details.profile;

    return [
      { label: 'LinkedIn', icon: 'fa-brands fa-linkedin', url: profile?.linkedinUrl || '' },
      { label: 'GitHub', icon: 'fa-brands fa-github', url: profile?.githubUrl || '' },
      { label: 'YouTube', icon: 'fa-brands fa-youtube', url: profile?.youtubeUrl || '' },
      { label: 'Portfolio', icon: 'fa-solid fa-globe', url: profile?.portfolioUrl || '' },
    ].filter((link) => link.url.trim() !== '');
  }

  private syncInstructorPayoutSummary(
    userId: number,
    summary: InstructorPayoutSummary | null | undefined,
  ): void {
    if (!summary) {
      return;
    }

    this.users = this.users.map((user) =>
      user.id === userId
        ? {
            ...user,
            instructorPayout: summary,
          }
        : user,
    );

    if (this.selectedInstructorUser?.id === userId) {
      this.selectedInstructorUser = {
        ...this.selectedInstructorUser,
        instructorPayout: summary,
      };
    }
  }

  private createEmptyMeta(): EmployeeListMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createEmptySummary(): EmployeeListSummary {
    return {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
    };
  }
}
