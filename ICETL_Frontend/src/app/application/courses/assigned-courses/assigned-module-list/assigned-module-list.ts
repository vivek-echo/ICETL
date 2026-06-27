import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { AssignedModuleStudentsModalComponent } from '../../shared/assigned-module-students-modal/assigned-module-students-modal';
import { ModuleMaterialsModalComponent } from '../../shared/module-materials-modal/module-materials-modal';
import {
  AssignedModule,
  ModuleMaterialsService,
  ModuleType,
  PaginationMeta,
} from '../../services/module-materials';

@Component({
  selector: 'app-assigned-module-list',
  imports: [CommonModule, FormsModule, ModuleMaterialsModalComponent, AssignedModuleStudentsModalComponent],
  templateUrl: './assigned-module-list.html',
  styleUrl: './assigned-module-list.scss',
})
export class AssignedModuleList implements OnInit, OnDestroy {
  @Input() moduleType: ModuleType = 'ACADEMIC_COURSE';
  @Input() sectionTitle = 'Assigned Courses';
  @Input() emptyLabel = 'assigned modules';
  @Input() iconClass = 'fa-solid fa-graduation-cap';
  @Input() placeholderImage = 'assets/images/others/thumbnail-placeholder.svg';

  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  modules: AssignedModule[] = [];
  selectedModule: AssignedModule | null = null;
  selectedStudentsModule: AssignedModule | null = null;
  loading = false;
  showFilters = false;
  search = '';
  page = 1;
  perPage = 10;
  meta: PaginationMeta | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly materialsService: ModuleMaterialsService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadAssignedModules();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  async loadAssignedModules(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.materialsService.getAssignedModules({
          moduleType: this.moduleType,
          search: this.search,
          page: this.page,
          perPage: this.perPage,
        }),
      );
      this.modules = response.success || response.status ? response.data ?? [] : [];
      this.meta = response.meta ?? null;
    } catch (error: unknown) {
      this.modules = [];
      this.meta = null;
      await this.alertHelper.error(
        this.errorMessage(error, `Unable to fetch ${this.emptyLabel}.`),
        this.sectionTitle,
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onSearchChange(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.page = 1;
      void this.loadAssignedModules();
    }, 300);
  }

  clearSearch(): void {
    if (!this.search) {
      return;
    }

    this.search = '';
    this.page = 1;
    void this.loadAssignedModules();
  }

  openMaterials(module: AssignedModule): void {
    this.selectedModule = module;
  }

  closeMaterials(): void {
    this.selectedModule = null;
  }

  openStudents(module: AssignedModule): void {
    this.selectedStudentsModule = module;
  }

  closeStudents(): void {
    this.selectedStudentsModule = null;
  }

  onMaterialsChanged(count: number): void {
    if (!this.selectedModule) {
      return;
    }

    this.selectedModule.materialsCount = count;
    this.modules = this.modules.map((module) =>
      module.moduleType === this.selectedModule?.moduleType &&
      module.moduleId === this.selectedModule?.moduleId
        ? { ...module, materialsCount: count }
        : module,
    );
    this.cdr.detectChanges();
  }

  previousPage(): void {
    if (!this.meta || this.meta.currentPage <= 1 || this.loading) {
      return;
    }

    this.page = this.meta.currentPage - 1;
    void this.loadAssignedModules();
  }

  nextPage(): void {
    if (!this.meta || this.meta.currentPage >= this.meta.lastPage || this.loading) {
      return;
    }

    this.page = this.meta.currentPage + 1;
    void this.loadAssignedModules();
  }

  moduleImage(module: AssignedModule): string {
    return module.thumbnailUrl || this.placeholderImage;
  }

  onModuleImageError(module: AssignedModule): void {
    module.thumbnailUrl = null;
  }

  getDateRange(module: AssignedModule): string {
    const start = this.formatDate(module.startDate);
    const end = this.formatDate(module.endDate);

    if (start === 'N/A' && end === 'N/A') {
      return 'Date TBA';
    }

    if (end === 'N/A' || start === end) {
      return start;
    }

    return `${start} - ${end}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    const normalized = value.includes('T')
      ? value
      : value.includes(' ')
        ? value.replace(' ', 'T')
        : `${value}T00:00:00`;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  scheduleLabel(module: AssignedModule): string {
    const labels: Record<string, string> = {
      upcoming: 'Upcoming',
      ongoing: 'Ongoing',
      completed: 'Completed',
    };

    return labels[module.scheduleStatus ?? ''] ?? 'Upcoming';
  }

  isSpecialCourse(module: AssignedModule): boolean {
    return module.isSpecial === true || Number(module.isSpecial ?? 0) === 1;
  }

  getPrimaryCourseLabel(module: AssignedModule): string {
    const title = `${module.parentCourseTitle || ''}`.trim();
    const code = `${module.parentCourseCode || ''}`.trim();

    if (title && code) {
      return `${title} (${code})`;
    }

    return title || code;
  }

  trackByModuleId(_: number, module: AssignedModule): string {
    return `${module.moduleType}-${module.moduleId}`;
  }

  get totalModules(): number {
    return this.meta?.total ?? this.modules.length;
  }

  get canGoPrevious(): boolean {
    return !!this.meta && this.meta.currentPage > 1;
  }

  get canGoNext(): boolean {
    return !!this.meta && this.meta.currentPage < this.meta.lastPage;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: string }; message?: string };
    return response.error?.message || response.message || fallback;
  }
}
