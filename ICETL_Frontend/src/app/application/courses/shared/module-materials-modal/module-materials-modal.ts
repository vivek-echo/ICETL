import { CommonModule } from '@angular/common';
import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, lastValueFrom, map, tap } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import {
  ApiResponse,
  ModuleMaterial,
  ModuleMaterialsService,
  ModuleType,
} from '../../services/module-materials';
import {
  ModalWindowControlsComponent,
  ModalWindowDirective,
} from '../../../../shared/modal-window';

interface MaterialGroup {
  key: string;
  label: string;
  materials: ModuleMaterial[];
}

@Component({
  selector: 'app-module-materials-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalWindowControlsComponent,
    ModalWindowDirective,
  ],
  templateUrl: './module-materials-modal.html',
  styleUrl: './module-materials-modal.scss',
})
export class ModuleMaterialsModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly materialService = inject(ModuleMaterialsService);
  private readonly alertHelper = inject(AlertHelperService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) moduleType!: ModuleType;
  @Input({ required: true }) moduleId!: number;
  @Input({ required: true }) moduleTitle!: string;
  @Input() canUpload = false;
  @Input() canDelete = false;

  @Output() closed = new EventEmitter<void>();
  @Output() materialsChanged = new EventEmitter<number>();

  readonly allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'zip'];
  readonly maxFileSizeBytes = 20 * 1024 * 1024;
  readonly skeletonRows = Array.from({ length: 4 }, (_, index) => index);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(2000)]],
    materialDate: [this.todayString()],
  });

  materials: ModuleMaterial[] = [];
  loadingMaterials = false;
  uploading = false;
  deletingMaterialId: number | null = null;
  uploadProgress = 0;
  selectedFile: File | null = null;
  fileError = '';
  listError = '';

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['moduleType'] || changes['moduleId']) && this.moduleType && this.moduleId > 0) {
      void this.loadMaterials();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.attemptClose();
  }

  get titleControlInvalid(): boolean {
    const control = this.form.controls.title;
    return control.invalid && (control.dirty || control.touched);
  }

  get descriptionControlInvalid(): boolean {
    const control = this.form.controls.description;
    return control.invalid && (control.dirty || control.touched);
  }

  get selectedFileSizeLabel(): string {
    return this.selectedFile ? this.formatBytes(this.selectedFile.size) : '';
  }

  async loadMaterials(silent = false): Promise<void> {
    if (!this.moduleType || !this.moduleId) {
      return;
    }

    this.loadingMaterials = !silent;
    this.listError = '';
    this.cdr.markForCheck();

    try {
      const response = await lastValueFrom(
        this.materialService.getMaterials(this.moduleType, this.moduleId),
      );
      this.materials = response.success || response.status ? response.data ?? [] : [];
      this.materialsChanged.emit(this.materials.length);
    } catch (error: unknown) {
      this.materials = [];
      this.listError = this.errorMessage(error, 'Unable to load materials.');
    } finally {
      this.loadingMaterials = false;
      this.cdr.detectChanges();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.attemptClose();
    }
  }

  attemptClose(): void {
    if (this.uploading) {
      void this.alertHelper.warning('Please wait until the upload finishes.', 'Upload in progress');
      return;
    }

    this.closed.emit();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.selectedFile = null;
    this.fileError = '';

    if (!file) {
      return;
    }

    const extension = this.fileExtension(file.name);

    if (!this.allowedExtensions.includes(extension)) {
      this.fileError = 'Use PDF, Office, image, or ZIP files only.';
      input.value = '';
      return;
    }

    if (file.size > this.maxFileSizeBytes) {
      this.fileError = 'Maximum file size is 20 MB.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
  }

  clearSelectedFile(fileInput?: HTMLInputElement): void {
    this.selectedFile = null;
    this.fileError = '';
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async uploadMaterial(fileInput?: HTMLInputElement): Promise<void> {
    if (!this.canUpload || this.uploading) {
      return;
    }

    this.form.markAllAsTouched();

    if (!this.selectedFile) {
      this.fileError = 'Please choose a material file.';
      return;
    }

    if (this.form.invalid || this.fileError) {
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    try {
      const response = await lastValueFrom(
        this.materialService
          .uploadMaterial({
            moduleType: this.moduleType,
            moduleId: this.moduleId,
            title: this.form.controls.title.value.trim(),
            description: this.form.controls.description.value.trim(),
            materialDate: this.form.controls.materialDate.value,
            file: this.selectedFile,
          })
          .pipe(
            tap((event) => this.captureUploadProgress(event)),
            filter(this.isUploadResponse),
            map((event) => event.body),
          ),
      );

      if (!response?.success && !response?.status) {
        await this.alertHelper.error(response?.message || 'Unable to upload material.', 'Materials');
        return;
      }

      this.resetUploadForm(fileInput);
      await this.loadMaterials(true);
      await this.alertHelper.success('Material uploaded successfully.', 'Materials');
    } catch (error: unknown) {
      await this.alertHelper.error(this.errorMessage(error, 'Unable to upload material.'), 'Materials');
    } finally {
      this.uploading = false;
      this.uploadProgress = 0;
    }
  }

  async openMaterial(material: ModuleMaterial): Promise<void> {
    try {
      const response = await lastValueFrom(this.materialService.downloadMaterial(material.id, false));
      this.openBlob(response, material);
    } catch (error: unknown) {
      await this.alertHelper.error(this.errorMessage(error, 'Unable to open material.'), 'Materials');
    }
  }

  async saveMaterial(material: ModuleMaterial): Promise<void> {
    try {
      const response = await lastValueFrom(this.materialService.downloadMaterial(material.id, true));
      this.downloadBlob(response, material);
    } catch (error: unknown) {
      await this.alertHelper.error(this.errorMessage(error, 'Unable to download material.'), 'Materials');
    }
  }

  async deleteMaterial(material: ModuleMaterial): Promise<void> {
    if (!this.canDelete || this.deletingMaterialId) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `Delete "${material.title}" from this module?`,
      'Delete material',
      'Delete',
      'Cancel',
      'warning',
    );

    if (!confirmed) {
      return;
    }

    this.deletingMaterialId = material.id;

    try {
      const response = await lastValueFrom(this.materialService.deleteMaterial(material.id));

      if (!response.success && !response.status) {
        await this.alertHelper.error(response.message || 'Unable to delete material.', 'Materials');
        return;
      }

      await this.loadMaterials(true);
      await this.alertHelper.success('Material deleted successfully.', 'Materials');
    } catch (error: unknown) {
      await this.alertHelper.error(this.errorMessage(error, 'Unable to delete material.'), 'Materials');
    } finally {
      this.deletingMaterialId = null;
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    const date = this.parseDate(value);

    if (!date) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    const date = this.parseDate(value);

    if (!date) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  extensionLabel(material: ModuleMaterial): string {
    const extension = `${material.fileExtension || this.fileExtension(material.originalFileName)}`.trim();
    return extension ? extension.toUpperCase() : 'FILE';
  }

  fileIconClass(material: ModuleMaterial): string {
    const extension = `${material.fileExtension || this.fileExtension(material.originalFileName)}`.toLowerCase();

    if (extension === 'pdf') {
      return 'fa-regular fa-file-pdf';
    }

    if (['doc', 'docx'].includes(extension)) {
      return 'fa-regular fa-file-word';
    }

    if (['ppt', 'pptx'].includes(extension)) {
      return 'fa-regular fa-file-powerpoint';
    }

    if (['xls', 'xlsx'].includes(extension)) {
      return 'fa-regular fa-file-excel';
    }

    if (['jpg', 'jpeg', 'png'].includes(extension)) {
      return 'fa-regular fa-file-image';
    }

    if (extension === 'zip') {
      return 'fa-regular fa-file-zipper';
    }

    return 'fa-regular fa-file-lines';
  }

  get groupedMaterials(): MaterialGroup[] {
    const groups = new Map<string, MaterialGroup>();
    const sortedMaterials = [...this.materials].sort(
      (first, second) => this.materialSortTime(second) - this.materialSortTime(first),
    );

    sortedMaterials.forEach((material) => {
      const key = this.materialGroupKey(material);
      const label = key === 'undated' ? 'Date not set' : this.formatDate(key);

      if (!groups.has(key)) {
        groups.set(key, { key, label, materials: [] });
      }

      groups.get(key)?.materials.push(material);
    });

    return Array.from(groups.values());
  }

  trackByMaterialId(_: number, material: ModuleMaterial): number {
    return material.id;
  }

  trackByMaterialGroup(_: number, group: MaterialGroup): string {
    return group.key;
  }

  private resetUploadForm(fileInput?: HTMLInputElement): void {
    this.form.reset({
      title: '',
      description: '',
      materialDate: this.todayString(),
    });
    this.clearSelectedFile(fileInput);
  }

  private captureUploadProgress(event: HttpEvent<ApiResponse<ModuleMaterial>>): void {
    if (event.type !== HttpEventType.UploadProgress) {
      return;
    }

    if (!event.total) {
      this.uploadProgress = 0;
      return;
    }

    this.uploadProgress = Math.round((event.loaded / event.total) * 100);
  }

  private isUploadResponse(
    event: HttpEvent<ApiResponse<ModuleMaterial>>,
  ): event is HttpResponse<ApiResponse<ModuleMaterial>> {
    return event.type === HttpEventType.Response;
  }

  private openBlob(response: HttpResponse<Blob>, material: ModuleMaterial): void {
    const blob = response.body;
    if (!blob) {
      return;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');

    if (!opened) {
      this.downloadBlob(response, material);
    }

    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
  }

  private downloadBlob(response: HttpResponse<Blob>, material: ModuleMaterial): void {
    const blob = response.body;
    if (!blob) {
      return;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = this.downloadFileName(response, material);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(blobUrl);
  }

  private downloadFileName(response: HttpResponse<Blob>, material: ModuleMaterial): string {
    const disposition = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^"]+)"?/i.exec(disposition);

    return decodeURIComponent(match?.[1] ?? material.originalFileName ?? 'material-download');
  }

  private fileExtension(fileName: string): string {
    const segments = fileName.toLowerCase().split('.');
    return segments.length > 1 ? segments.pop() ?? '' : '';
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${unitIndex === 0 ? size.toFixed(0) : size.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
  }

  private parseDate(value: string): Date | null {
    const normalized = value.includes('T')
      ? value
      : value.includes(' ')
        ? value.replace(' ', 'T')
        : `${value}T00:00:00`;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private materialGroupKey(material: ModuleMaterial): string {
    const date = this.parseDate(`${material.materialDate || material.createdAt || ''}`);

    if (!date) {
      return 'undated';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private materialSortTime(material: ModuleMaterial): number {
    const date = this.parseDate(`${material.materialDate || material.createdAt || ''}`);

    return date?.getTime() ?? 0;
  }

  private todayString(): string {
    return new Date().toISOString().slice(0, 10);
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
