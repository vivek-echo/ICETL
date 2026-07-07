import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyProgram, MyProgramType, PaymentService } from '../../services/payment';
import { NgxSpinnerService } from 'ngx-spinner';
import { CertificateHistoryItem, CertificateService } from '../../services/certificate.service';
import { ModuleMaterialsModalComponent } from '../../shared/module-materials-modal/module-materials-modal';
@Component({
  selector: 'app-my-seminar',
  imports: [CommonModule, FormsModule, RouterLink, ModuleMaterialsModalComponent],
  templateUrl: './my-seminar.html',
  styleUrl: './my-seminar.scss',
})
export class MySeminar implements OnInit {
  readonly programType: MyProgramType = 'seminar';
  readonly singularLabel = 'Seminar';
  readonly pluralLabel = 'Seminars';
  readonly browseRoute = '/application/courses/manageCourses/browseSeminars';
  readonly placeholderImage = 'assets/images/event/grid-type-02.jpg';
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  programs: MyProgram[] = [];
  loading = false;
  showFilters = false;
  search = '';
  scheduleFilter: 'all' | 'upcoming' | 'ongoing' | 'completed' = 'all';
  selectedMaterialsProgram: MyProgram | null = null;

  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  certificateLoading = false;
  certificateLoadingProgramId: number | null = null;
  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
    private readonly spinner: NgxSpinnerService,
    private readonly certificateService: CertificateService,
  ) {}

  ngOnInit(): void {
    void this.loadPrograms();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  async downloadWorkshopCertificate(courseId: number, courseType: any): Promise<void> {
    if (!courseId || this.certificateLoading) {
      return;
    }

    const program = this.programs.find((item) => Number(item.id) === Number(courseId));
    const payload = {
      moduleType: 'SEMINAR',
      moduleId: courseId,
    };

    this.spinner.show();
    this.certificateLoading = true;
    this.certificateLoadingProgramId = courseId;

    try {
      let downloadUrl = program?.certificateDownloadUrl || '';
      let certificateNo = program?.certificateNo || '';

      if (!downloadUrl) {
        const res: any = await lastValueFrom(this.certificateService.generateCertificate(payload));
        downloadUrl = res?.downloadUrl || res?.data?.downloadUrl;
        certificateNo = res?.certificateNo || res?.data?.certificateNo || certificateNo;
      }

      if (!downloadUrl) {
        await this.alertHelper.error(
          'Certificate was prepared, but the download link was not returned.',
          'Certificate',
        );
        return;
      }

      /**
       * Fetch PDF as Blob and force browser download
       */
      const fileResponse: any = await lastValueFrom(
        this.certificateService.downloadCertificateFile(downloadUrl),
      );

      const blob = fileResponse.body;

      if (!blob) {
        await this.alertHelper.error('Certificate file could not be downloaded.', 'Certificate');
        return;
      }

      const fileName = `seminar-certificate-${courseId}.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';

      document.body.appendChild(anchor);
      anchor.click();

      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);

      if (program) {
        program.certificateNo = certificateNo || program.certificateNo;
        program.certificateDownloadUrl = downloadUrl;
        program.certificateStatus = 'active';
      }
    } catch (error: any) {
      const message =
        error?.error?.message || error?.error?.msg || 'Unable to generate certificate.';

      await this.alertHelper.error(message, 'Certificate');
    } finally {
      this.certificateLoading = false;
      this.certificateLoadingProgramId = null;
      this.spinner.hide();
      this.cdr.detectChanges();
    }
  }

  async loadPrograms(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getMyPrograms(this.programType));
      this.programs = response.success ? (response.data ?? []) : [];
      await this.applyCertificateHistory();
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || `Unable to fetch your enrolled ${this.pluralLabel.toLowerCase()}.`,
        `My ${this.pluralLabel}`,
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openMaterials(program: MyProgram): void {
    this.selectedMaterialsProgram = program;
  }

  closeMaterials(): void {
    this.selectedMaterialsProgram = null;
  }

  programImage(program: MyProgram): string {
    return program.bannerImageUrl || this.placeholderImage;
  }

  onProgramImageError(program: MyProgram): void {
    program.bannerImageUrl = null;
  }

  getDateRange(program: MyProgram): string {
    const startDate = this.formatDate(program.startDate || program.eventDate);
    const endDate = this.formatDate(program.endDate || '');

    if (!startDate && !endDate) {
      return 'Date TBA';
    }

    if (!endDate || startDate === endDate) {
      return startDate;
    }

    return `${startDate} - ${endDate}`;
  }

  getTimeRange(program: MyProgram): string {
    if (!program.startTime && !program.endTime) {
      return 'Time TBA';
    }

    return program.endTime
      ? `${program.startTime} - ${program.endTime}`
      : program.startTime || 'Time TBA';
  }

  getScheduleLabel(program: MyProgram): string {
    const labels = {
      upcoming: 'Upcoming',
      ongoing: 'Ongoing',
      completed: 'Completed',
    };

    return labels[program.scheduleStatus] ?? 'Upcoming';
  }

  isCertificateGenerating(programId: number): boolean {
    return this.certificateLoadingProgramId === programId;
  }

  getProgramNextStep(program: MyProgram): string {
    if (program.certificateNo) {
      return program.certificateIssueDate
        ? `Certificate issued ${this.formatDate(program.certificateIssueDate)}`
        : `Certificate issued ${program.certificateNo}`;
    }

    if (program.scheduleStatus === 'completed') {
      return 'Download certificate when available';
    }

    if (program.scheduleStatus === 'ongoing') {
      return 'Open materials and attend the current session';
    }

    return 'Review schedule and materials before the session';
  }

  getTakeaways(program: MyProgram, limit = 3): string[] {
    return (program.takeaways ?? []).slice(0, limit);
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const normalizedValue = value.includes('T')
      ? value
      : value.includes(' ')
        ? value.replace(' ', 'T')
        : `${value}T00:00:00`;
    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  trackByProgramId(_: number, program: MyProgram): number {
    return program.purchaseId;
  }

  get filteredPrograms(): MyProgram[] {
    const term = this.search.trim().toLowerCase();

    return this.programs.filter((program) => {
      const matchesSearch =
        !term ||
        program.title.toLowerCase().includes(term) ||
        (program.topic || '').toLowerCase().includes(term) ||
        (program.speakerName || '').toLowerCase().includes(term) ||
        (program.city || '').toLowerCase().includes(term) ||
        (program.code || '').toLowerCase().includes(term);
      const matchesSchedule =
        this.scheduleFilter === 'all' || program.scheduleStatus === this.scheduleFilter;

      return matchesSearch && matchesSchedule;
    });
  }

  get activeProgramsCount(): number {
    return this.programs.filter((program) => program.scheduleStatus !== 'completed').length;
  }

  get completedProgramsCount(): number {
    return this.programs.filter((program) => program.scheduleStatus === 'completed').length;
  }

  private async applyCertificateHistory(): Promise<void> {
    if (!this.programs.length) {
      return;
    }

    try {
      const response = await lastValueFrom(this.certificateService.getCertificateHistory());
      const certificates = response.data?.items ?? [];

      this.programs = this.programs.map((program) => {
        const certificate = this.findProgramCertificate(program, certificates);

        if (!certificate) {
          return program;
        }

        return {
          ...program,
          certificateNo: certificate.certificateNo,
          certificateDownloadUrl: certificate.downloadUrl,
          certificateStatus: certificate.status,
          certificateIssueDate: certificate.issueDate,
        };
      });
    } catch {
      // Certificate history is supportive only; keep enrolled seminars visible if it fails.
    }
  }

  private findProgramCertificate(
    program: MyProgram,
    certificates: CertificateHistoryItem[],
  ): CertificateHistoryItem | undefined {
    return certificates.find((certificate) =>
      Number(certificate.moduleId) === Number(program.id) &&
      `${certificate.moduleType || ''}`.toUpperCase() === 'SEMINAR',
    );
  }
}
