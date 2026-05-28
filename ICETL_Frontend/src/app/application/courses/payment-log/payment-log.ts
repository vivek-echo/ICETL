import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { Invoice, PaymentLog, PaymentService } from '../services/payment';

@Component({
  selector: 'app-payment-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-log.html',
  styleUrl: './payment-log.scss',
})
export class PaymentLogComponent implements OnInit {
  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

  logs: PaymentLog[] = [];
  selectedInvoice: Invoice | null = null;
  loading = false;
  invoiceLoading = false;
  search = '';
  status = 'all';
  currentPage = 1;
  lastPage = 1;
  total = 0;
  perPage = 10;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadPaymentLogs();
  }

  async loadPaymentLogs(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.paymentService.getPaymentLogs({
          page: this.currentPage,
          perPage: this.perPage,
          status: this.status,
          search: this.search.trim(),
        }),
      );
      this.logs = response.success ? response.data ?? [] : [];
      this.currentPage = response.meta?.currentPage ?? 1;
      this.lastPage = response.meta?.lastPage ?? 1;
      this.total = response.meta?.total ?? this.logs.length;
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch payment logs',
        'Payment Logs',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async viewInvoice(orderId: number): Promise<void> {
    this.invoiceLoading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getInvoice(orderId));
      this.selectedInvoice = response.data;
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch invoice',
        'Invoice',
      );
    } finally {
      this.invoiceLoading = false;
      this.cdr.detectChanges();
    }
  }

  closeInvoice(): void {
    this.selectedInvoice = null;
  }

  printInvoice(): void {
    window.print();
  }

  downloadInvoicePdf(): void {
    if (!this.selectedInvoice) {
      return;
    }

    window.open(this.paymentService.getInvoiceDownloadUrl(this.selectedInvoice.orderId), '_blank');
  }

  applyFilters(): void {
    this.currentPage = 1;
    void this.loadPaymentLogs();
  }

  clearFilters(): void {
    this.search = '';
    this.status = 'all';
    this.currentPage = 1;
    void this.loadPaymentLogs();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    void this.loadPaymentLogs();
  }

  get statusOptions(): string[] {
    return ['all', 'paid', 'failed', 'cancelled', 'pending'];
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
