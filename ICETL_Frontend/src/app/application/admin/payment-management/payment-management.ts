import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { AdminPaymentDashboard, PaymentService } from '../../courses/services/payment';

@Component({
  selector: 'app-payment-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-management.html',
  styleUrl: './payment-management.scss',
})
export class PaymentManagement implements OnInit {
  private readonly amountFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  dashboard: AdminPaymentDashboard | null = null;
  loading = false;

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
      const response = await lastValueFrom(this.paymentService.getAdminPayments());
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

  exportCsv(): void {
    const rows = this.dashboard?.recentTransactions ?? [];
    const header = ['Order', 'Student', 'Email', 'Amount', 'Status', 'Transaction No', 'Invoice', 'Entity Code', 'Entity Title', 'Date'];
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.orderReference,
          row.userName || '',
          row.userEmail || '',
          row.totalAmount,
          row.status,
          this.transactionIdentifier(row),
          row.invoiceNumber || '',
          row.entityCode || '',
          row.entityTitle || '',
          row.created_at,
        ]
          .map((value) => `"${`${value}`.replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    };

    return labels[normalized] || value || '';
  }
}
