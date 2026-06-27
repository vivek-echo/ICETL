import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  AssignedModuleStudent,
  AssignedModuleStudentSummary,
  ModuleMaterialsService,
  ModuleType,
  PaginationMeta,
} from '../../services/module-materials';
import {
  ModalWindowControlsComponent,
  ModalWindowDirective,
} from '../../../../shared/modal-window';

@Component({
  selector: 'app-assigned-module-students-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalWindowControlsComponent, ModalWindowDirective],
  templateUrl: './assigned-module-students-modal.html',
  styleUrl: './assigned-module-students-modal.scss',
})
export class AssignedModuleStudentsModalComponent implements OnChanges, OnDestroy {
  private readonly moduleService = inject(ModuleMaterialsService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) moduleType!: ModuleType;
  @Input({ required: true }) moduleId!: number;
  @Input({ required: true }) moduleTitle!: string;
  @Input() moduleTypeLabel = 'Course';

  @Output() closed = new EventEmitter<void>();

  readonly skeletonRows = Array.from({ length: 4 }, (_, index) => index);

  students: AssignedModuleStudent[] = [];
  summary: AssignedModuleStudentSummary = this.createDefaultSummary();
  meta: PaginationMeta = this.createDefaultMeta();
  loading = false;
  listError = '';
  search = '';
  page = 1;
  perPage = 10;

  private requestSerial = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['moduleType'] || changes['moduleId']) && this.moduleType && this.moduleId > 0) {
      this.resetState();
      void this.loadStudents();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  async loadStudents(page = this.page): Promise<void> {
    if (!this.moduleType || !this.moduleId) {
      return;
    }

    const requestId = ++this.requestSerial;
    this.loading = true;
    this.listError = '';
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.moduleService.getAssignedModuleStudents({
          moduleType: this.moduleType,
          moduleId: this.moduleId,
          search: this.search,
          page,
          perPage: this.perPage,
        }),
      );

      if (requestId !== this.requestSerial) {
        return;
      }

      if (response.success || response.status) {
        this.students = response.data ?? [];
        this.summary = response.summary ?? this.createDefaultSummary();
        this.meta = response.meta ?? this.createDefaultMeta();
        this.page = this.meta.currentPage || 1;
      } else {
        this.students = [];
        this.listError = response.message || 'Unable to load enrolled students.';
      }
    } catch (error: unknown) {
      if (requestId === this.requestSerial) {
        this.students = [];
        this.summary = this.createDefaultSummary();
        this.meta = this.createDefaultMeta();
        this.listError = this.errorMessage(error, 'Unable to load enrolled students.');
      }
    } finally {
      if (requestId === this.requestSerial) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  onSearchChange(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.page = 1;
      void this.loadStudents(1);
    }, 300);
  }

  clearSearch(): void {
    if (!this.search) {
      return;
    }

    this.search = '';
    this.page = 1;
    void this.loadStudents(1);
  }

  refresh(): void {
    void this.loadStudents(this.page);
  }

  previousPage(): void {
    if (!this.canGoPrevious || this.loading) {
      return;
    }

    void this.loadStudents(this.meta.currentPage - 1);
  }

  nextPage(): void {
    if (!this.canGoNext || this.loading) {
      return;
    }

    void this.loadStudents(this.meta.currentPage + 1);
  }

  trackByStudent(_: number, student: AssignedModuleStudent): number {
    return student.id;
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

    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(date);
  }

  formatMoney(value: unknown): string {
    const amount = Number(value);

    return Number.isFinite(amount)
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(amount)
      : 'N/A';
  }

  genderLabel(value: number | null | undefined): string {
    if (value === 1) {
      return 'Male';
    }

    if (value === 2) {
      return 'Female';
    }

    return 'N/A';
  }

  studentInitials(student: AssignedModuleStudent): string {
    const parts = student.studentName
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return (parts[0]?.[0] ?? 'S') + (parts[1]?.[0] ?? '');
  }

  getPaginationLabel(): string {
    return `Showing ${this.meta.from || 0}-${this.meta.to || 0} of ${this.meta.total}`;
  }

  get canGoPrevious(): boolean {
    return this.meta.currentPage > 1;
  }

  get canGoNext(): boolean {
    return this.meta.currentPage < this.meta.lastPage;
  }

  private resetState(): void {
    this.students = [];
    this.summary = this.createDefaultSummary();
    this.meta = this.createDefaultMeta();
    this.loading = false;
    this.listError = '';
    this.search = '';
    this.page = 1;
  }

  private createDefaultSummary(): AssignedModuleStudentSummary {
    return { totalEnrollments: 0, totalStudents: 0, totalPaid: 0 };
  }

  private createDefaultMeta(): PaginationMeta {
    return { currentPage: 1, perPage: 10, total: 0, lastPage: 1, from: null, to: null };
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as {
      error?: { message?: string; errors?: Record<string, string[]> };
      message?: string;
    };
    const firstValidationMessage = Object.values(response.error?.errors ?? {})
      .flat()
      .find((message) => !!message);

    return response.error?.message || firstValidationMessage || response.message || fallback;
  }
}
