import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyProgram, MyProgramType, PaymentService } from '../../services/payment';

@Component({
  selector: 'app-my-workshop',
  imports: [CommonModule, FormsModule, RouterLink],
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

  programs: MyProgram[] = [];
  loading = false;
  search = '';
  scheduleFilter: 'all' | 'upcoming' | 'ongoing' | 'completed' = 'all';

  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadPrograms();
  }

  async loadPrograms(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getMyPrograms(this.programType));
      this.programs = response.success ? response.data ?? [] : [];
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

    return program.endTime ? `${program.startTime} - ${program.endTime}` : program.startTime || 'Time TBA';
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
