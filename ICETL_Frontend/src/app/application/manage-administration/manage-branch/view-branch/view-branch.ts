import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../../shared/modal-window';
import {
  AdministrationService,
  Branch,
  BranchListMeta,
  BranchListSummary,
  LocationDistrict,
  LocationState,
} from '../../services/administration';

@Component({
  selector: 'app-view-branch',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ModalWindowDirective,
    ModalWindowControlsComponent,
  ],
  templateUrl: './view-branch.html',
  styleUrl: './view-branch.scss',
})
export class ViewBranch implements OnInit {
  readonly perPageOptions = [10, 20, 50, 100];
  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: '1' },
    { label: 'Inactive', value: '0' },
  ];

  branches: Branch[] = [];
  states: LocationState[] = [];
  districts: LocationDistrict[] = [];
  selectedBranch: Branch | null = null;

  loading = false;
  loadingStates = false;
  loadingDistricts = false;
  apiError = '';
  showFilters = false;

  filters = {
    branchName: '',
    stateCode: '',
    districtCode: '',
    status: 'all',
  };

  meta: BranchListMeta = this.createEmptyMeta();
  summary: BranchListSummary = this.createEmptySummary();

  constructor(
    private readonly administrationService: AdministrationService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadStates();
    void this.loadBranches();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
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
        'Branch Filters',
      );
    } finally {
      this.loadingStates = false;
      this.cdr.detectChanges();
    }
  }

  onFilterStateChange(): void {
    const stateCode = Number(this.filters.stateCode || 0);

    this.filters.districtCode = '';
    this.districts = [];

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
        'Branch Filters',
      );
    } finally {
      this.loadingDistricts = false;
      this.cdr.detectChanges();
    }
  }

  async loadBranches(page = this.meta.currentPage): Promise<void> {
    this.loading = true;
    this.apiError = '';
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.getBranches({
          page,
          perPage: this.meta.perPage,
          branchName: this.filters.branchName.trim(),
          stateCode: this.filters.stateCode,
          districtCode: this.filters.districtCode,
          status: this.filters.status,
        }),
      );

      if (response.status || response.success) {
        this.branches = response.data ?? [];
        this.meta = response.meta ?? this.createEmptyMeta();
        this.summary = response.summary ?? this.createEmptySummary();

        if (this.branches.length === 0 && this.meta.currentPage > 1 && this.meta.total > 0) {
          await this.loadBranches(this.meta.currentPage - 1);
        }
      } else {
        this.branches = [];
        this.meta = this.createEmptyMeta();
        this.summary = this.createEmptySummary();
        this.apiError = response.message || 'Unable to fetch branches.';
      }
    } catch (error: any) {
      this.branches = [];
      this.meta = this.createEmptyMeta();
      this.summary = this.createEmptySummary();
      this.apiError = error?.error?.message || 'Unable to fetch branches.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilters(): void {
    void this.loadBranches(1);
  }

  resetFilters(): void {
    this.filters = {
      branchName: '',
      stateCode: '',
      districtCode: '',
      status: 'all',
    };
    this.districts = [];
    void this.loadBranches(1);
  }

  onPerPageChange(): void {
    void this.loadBranches(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.meta.lastPage || page === this.meta.currentPage) {
      return;
    }

    void this.loadBranches(page);
  }

  openBranchDetails(branch: Branch): void {
    this.selectedBranch = branch;
  }

  closeBranchDetails(): void {
    this.selectedBranch = null;
  }

  trackByBranchId(_: number, branch: Branch): number {
    return branch.id;
  }

  isActive(branch: Branch): boolean {
    return Number(branch.status) === 1;
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

  private createEmptyMeta(): BranchListMeta {
    return {
      currentPage: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
      from: null,
      to: null,
    };
  }

  private createEmptySummary(): BranchListSummary {
    return {
      totalBranches: 0,
      activeBranches: 0,
      inactiveBranches: 0,
    };
  }
}
