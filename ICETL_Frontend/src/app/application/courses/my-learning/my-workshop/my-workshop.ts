import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyProgram, MyProgramType, PaymentService } from '../../services/payment';
import { CertificateService } from '../../services/certificate.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ModuleMaterialsModalComponent } from '../../shared/module-materials-modal/module-materials-modal';
@Component({
  selector: 'app-my-workshop',
  imports: [CommonModule, FormsModule, RouterLink, ModuleMaterialsModalComponent],
  templateUrl: './my-workshop.html',
  styleUrl: './my-workshop.scss',
})
export class MyWorkshop implements OnInit {
  readonly programType: MyProgramType = 'workshop';
  readonly singularLabel = 'Workshop';
  readonly pluralLabel = 'Workshops';
  readonly browseRoute = '/application/courses/manageCourses/browseWorkshop';
  readonly placeholderImage = 'assets/images/event/grid-type-02.jpg';
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  certificateLoading = false;
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

  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly certificateService: CertificateService,
    private readonly cdr: ChangeDetectorRef,
    private readonly spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    void this.loadPrograms();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  // canDownloadWorkshopCertificate(course: any): boolean {
  //   const progress = Number(course?.progressPercent || 0);
  //   // return progress >= 75;
  //   return true;
  // }

  async downloadWorkshopCertificate(courseId: number, courseType: any): Promise<void> {
    if (!courseId || this.certificateLoading) {
      return;
    }

    const payload = {
      moduleType: 'WORKSHOP',
      moduleId: courseId,
    };

    this.spinner.show();
    this.certificateLoading = true;

    try {
      const res: any = await lastValueFrom(this.certificateService.generateCertificate(payload));

      const downloadUrl = res?.downloadUrl || res?.data?.downloadUrl;

      if (!downloadUrl) {
        return;
      }

      const fileResponse = await lastValueFrom(
        this.certificateService.downloadCertificateFile(downloadUrl),
      );

      const blob = fileResponse.body;

      if (!blob) {
        return;
      }

      const fileName = `workshop-certificate-${courseId}.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';

      document.body.appendChild(anchor);
      anchor.click();

      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      const message =
        error?.error?.message || error?.error?.msg || 'Unable to generate certificate.';

      // Swal.fire('Error', message, 'error');
    } finally {
      this.certificateLoading = false;
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
}
