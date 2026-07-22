import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { AdminPaymentDashboard, PaymentService } from '../courses/services/payment';

@Component({
  selector: 'app-payment-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-management.html',
  styleUrl: './payment-management.scss',
})
export class PaymentManagement implements OnInit {
  private readonly amountFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  dashboard: AdminPaymentDashboard | null = null;
  loading = false;
  exporting = false;
  showFilters = false;
  search = '';
  status = 'all';
  fromDate = '';
  toDate = '';
  user = '';
  moduleType = 'all';
  paymentMethod = 'all';

  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getAdminPayments(this.filterParams()));
      this.dashboard = response.data;
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch payment dashboard',
        'Admin Payments',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async exportCsv(): Promise<void> {
    this.exporting = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.exportAdminPayments(this.filterParams()));
      const blob = response.body;

      if (!blob) {
        throw new Error('Export file was empty.');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.exportFileName(response.headers.get('content-disposition'));
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to export payment transactions',
        'Admin Payments',
      );
    } finally {
      this.exporting = false;
      this.cdr.detectChanges();
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    void this.loadDashboard();
  }

  clearFilters(): void {
    this.search = '';
    this.status = 'all';
    this.fromDate = '';
    this.toDate = '';
    this.user = '';
    this.moduleType = 'all';
    this.paymentMethod = 'all';
    void this.loadDashboard();
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
  }

  formatDate(value: string | null | undefined): string {
    return value
      ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
      : 'N/A';
  }

  transactionIdentifier(row: AdminPaymentDashboard['recentTransactions'][number]): string {
    const value =
      row.paymentDisplayId ||
      row.razorpayPaymentId ||
      row.transactionNo ||
      row.paymentReference ||
      '';

    return value.toString().trim() || 'Pending';
  }

  paymentMethodLabel(row: AdminPaymentDashboard['recentTransactions'][number]): string {
    const value =
      row.paymentBy ||
      row.paymentMethod ||
      (row.razorpayPaymentId ? 'RAZORPAY' : '');
    const normalized = value.toString().trim().toUpperCase();
    const labels: Record<string, string> = {
      CASH: 'Cash',
      UPI: 'UPI',
      NETBANKING: 'Netbanking',
      RAZORPAY: 'Razorpay',
      BANK_TRANSFER: 'Bank Transfer',
      FREE: 'Free',
    };

    return labels[normalized] || value || '';
  }

  private filterParams(): Record<string, string> {
    return {
      search: this.search.trim(),
      status: this.status,
      fromDate: this.fromDate,
      toDate: this.toDate,
      user: this.user.trim(),
      moduleType: this.moduleType,
      paymentMethod: this.paymentMethod,
    };
  }

  private exportFileName(contentDisposition: string | null): string {
    const match = /filename="?([^"]+)"?/i.exec(contentDisposition || '');

    return match?.[1] || `payment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  }
}
