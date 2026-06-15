import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { ContactEnquiry, ContactEnquiryService } from '../../commonServices/contact-enquiry.service';

@Component({
  selector: 'app-enquiries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enquiries.html',
  styleUrl: './enquiries.scss',
})
export class EnquiriesComponent implements OnInit {
  enquiries: ContactEnquiry[] = [];
  loading = false;
  markingRead = false;
  search = '';
  readStatus = 'all';
  dateFrom = '';
  dateTo = '';
  currentPage = 1;
  lastPage = 1;
  total = 0;
  perPage = 10;
  unreadCount = 0;

  constructor(
    private readonly enquiryService: ContactEnquiryService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadEnquiries();
  }

  async loadEnquiries(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.enquiryService.getEnquiries({
          page: this.currentPage,
          perPage: this.perPage,
          search: this.search.trim(),
          readStatus: this.readStatus,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo,
        }),
      );

      this.enquiries = response.status ? response.data ?? [] : [];
      this.currentPage = response.meta?.currentPage ?? 1;
      this.lastPage = response.meta?.lastPage ?? 1;
      this.total = response.meta?.total ?? this.enquiries.length;
      this.unreadCount = response.summary?.unreadEnquiries ?? 0;
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch enquiries',
        'Enquiries',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilters(): void {
    this.currentPage = 1;
    void this.loadEnquiries();
  }

  clearFilters(): void {
    this.search = '';
    this.readStatus = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
    void this.loadEnquiries();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    void this.loadEnquiries();
  }

  async markAsRead(enquiry: ContactEnquiry): Promise<void> {
    if (enquiry.isRead || this.markingRead) {
      return;
    }

    this.markingRead = true;
    this.cdr.detectChanges();

    try {
      await lastValueFrom(this.enquiryService.markRead([enquiry.id]));
      enquiry.isRead = true;
      enquiry.statusLabel = 'Read';
      this.unreadCount = Math.max(this.unreadCount - 1, 0);
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to mark enquiry as read',
        'Enquiries',
      );
    } finally {
      this.markingRead = false;
      this.cdr.detectChanges();
    }
  }

  async markAllRead(): Promise<void> {
    if (this.unreadCount <= 0 || this.markingRead) {
      return;
    }

    const shouldMark = await this.alertHelper.confirm(
      'All unread enquiries will be marked as read.',
      'Mark all read?',
      'Mark Read',
      'Cancel',
      'question',
    );

    if (!shouldMark) {
      return;
    }

    this.markingRead = true;
    this.cdr.detectChanges();

    try {
      await lastValueFrom(this.enquiryService.markAllRead());
      await this.loadEnquiries();
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to mark enquiries as read',
        'Enquiries',
      );
    } finally {
      this.markingRead = false;
      this.cdr.detectChanges();
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  get readStatusOptions(): Array<{ value: string; label: string }> {
    return [
      { value: 'all', label: 'All enquiries' },
      { value: 'unread', label: 'Unread only' },
      { value: 'read', label: 'Read only' },
    ];
  }

  get hasActiveFilters(): boolean {
    return (
      this.search.trim().length > 0 ||
      this.readStatus !== 'all' ||
      this.dateFrom.length > 0 ||
      this.dateTo.length > 0
    );
  }
}
