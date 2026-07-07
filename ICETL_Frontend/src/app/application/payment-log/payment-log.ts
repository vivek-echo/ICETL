import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { Invoice, PaymentLog, PaymentService, PaymentWorkflow } from '../courses/services/payment';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../shared/modal-window';

@Component({
  selector: 'app-payment-log',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalWindowDirective, ModalWindowControlsComponent],
  templateUrl: './payment-log.html',
  styleUrl: './payment-log.scss',
})
export class PaymentLogComponent implements OnInit {
  readonly invoiceLogoPath = 'assets/images/logo/logo.jpeg';

  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

  logs: PaymentLog[] = [];
  selectedInvoice: Invoice | null = null;
  loading = false;
  invoiceLoading = false;
  invoiceLoadingOrderId: number | null = null;
  downloadingInvoice = false;
  search = '';
  status = 'all';
  workflow: PaymentWorkflow | null = null;
  currentPage = 1;
  lastPage = 1;
  total = 0;
  perPage = 10;
  showFilters = false;

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
      await this.loadPaymentWorkflow();
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
    if (this.invoiceLoadingOrderId === orderId) {
      return;
    }

    this.invoiceLoading = true;
    this.invoiceLoadingOrderId = orderId;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getInvoice(orderId));
      this.selectedInvoice = {
        ...response.data,
        orderId: Number(response.data?.orderId || orderId),
      };
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch invoice',
        'Invoice',
      );
    } finally {
      this.invoiceLoading = false;
      this.invoiceLoadingOrderId = null;
      this.cdr.detectChanges();
    }
  }

  closeInvoice(): void {
    this.selectedInvoice = null;
  }

  private async loadPaymentWorkflow(): Promise<void> {
    try {
      const response = await lastValueFrom(this.paymentService.getPaymentWorkflow());
      this.workflow = response.success ? response.data : null;
    } catch {
      this.workflow = null;
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  printInvoice(): void {
    if (!this.selectedInvoice) {
      return;
    }

    this.printInvoiceDocument(this.selectedInvoice);
  }

  async downloadInvoicePdf(): Promise<void> {
    if (!this.selectedInvoice) {
      return;
    }

    const orderId = Number(this.selectedInvoice.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      await this.alertHelper.error('Unable to identify this invoice order.', 'Invoice');
      return;
    }

    this.downloadingInvoice = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.paymentService.downloadInvoice(orderId),
      );
      const file = response.body;

      if (!file) {
        throw new Error('Invoice file was empty.');
      }

      this.saveBlob(
        file,
        this.invoiceDownloadName(
          response.headers.get('content-disposition'),
          this.selectedInvoice.invoiceNo,
        ),
      );
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to download invoice',
        'Invoice',
      );
    } finally {
      this.downloadingInvoice = false;
      this.cdr.detectChanges();
    }
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

  get pagePaidCount(): number {
    return this.logs.filter((log) => (log.status || '').toLowerCase() === 'paid').length;
  }

  get pageTotalAmount(): number {
    return this.logs.reduce((total, log) => total + (Number(log.totalAmount) || 0), 0);
  }

  get resultStart(): number {
    if (!this.total || this.logs.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.perPage + 1;
  }

  get resultEnd(): number {
    if (!this.total || this.logs.length === 0) {
      return 0;
    }

    return Math.min(this.resultStart + this.logs.length - 1, this.total);
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

  paymentIdentifier(record: Invoice | PaymentLog | null | undefined): string {
    const value =
      record?.paymentDisplayId ||
      record?.razorpayPaymentId ||
      record?.transactionNo ||
      record?.paymentReference ||
      '';

    return value.toString().trim() || 'Pending';
  }

  paymentMethodLabel(record: Invoice | PaymentLog | null | undefined): string {
    const value =
      record?.paymentBy ||
      record?.paymentMethod ||
      (record?.razorpayPaymentId ? 'RAZORPAY' : '');

    return this.formatPaymentMethod(value);
  }

  getPaymentStatusLabel(log: PaymentLog): string {
    const status = `${log.status || ''}`.trim().toLowerCase();
    const labels: Record<string, string> = {
      paid: 'Paid',
      failed: 'Failed',
      cancelled: 'Cancelled',
      pending: 'Pending',
    };

    return labels[status] || log.status || 'Pending';
  }

  getPaymentNextStep(log: PaymentLog): string {
    const status = `${log.status || ''}`.trim().toLowerCase();

    if (status === 'paid') {
      return log.invoiceNo ? 'Invoice is ready to view or download.' : 'Payment is paid; invoice is not linked yet.';
    }

    if (status === 'failed') {
      return log.failureReason || 'Payment failed. Start checkout again from the course or cart page.';
    }

    if (status === 'cancelled') {
      return 'Checkout was cancelled. Start a new checkout when you are ready.';
    }

    return 'Payment is pending. Refresh this page after completing payment.';
  }

  private formatPaymentMethod(value: string | null | undefined): string {
    const normalized = (value || '').toString().trim().toUpperCase();
    const labels: Record<string, string> = {
      CASH: 'Cash',
      UPI: 'UPI',
      NETBANKING: 'Netbanking',
      RAZORPAY: 'Razorpay',
    };

    return labels[normalized] || value || '';
  }

  private invoiceDownloadName(contentDisposition: string | null, invoiceNo: string): string {
    const matchedName = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];

    if (matchedName) {
      return matchedName;
    }

    return `${invoiceNo || 'invoice'}.html`;
  }

  private saveBlob(file: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }

  private printInvoiceDocument(invoice: Invoice): void {
    const frame = document.createElement('iframe');

    frame.style.border = '0';
    frame.style.height = '0';
    frame.style.left = '-9999px';
    frame.style.position = 'fixed';
    frame.style.top = '0';
    frame.style.width = '0';
    document.body.appendChild(frame);

    const frameDocument = frame.contentDocument || frame.contentWindow?.document;

    if (!frameDocument || !frame.contentWindow) {
      frame.remove();
      void this.alertHelper.error('Unable to open invoice print view.', 'Invoice');
      return;
    }

    frameDocument.open();
    frameDocument.write(this.invoicePrintHtml(invoice));
    frameDocument.close();

    window.setTimeout(() => {
      const cleanup = () => frame.remove();

      frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(cleanup, 10000);
    }, 150);
  }

  private invoicePrintHtml(invoice: Invoice): string {
    const itemRows = (invoice.items || [])
      .map((item) => {
        const entityCode = item.entityCode || item.code || '';

        return `
          <tr>
            <td>
              <strong>${this.escapeHtml(item.title || 'Course')}</strong>
              ${entityCode ? `<span class="entity-code">${this.escapeHtml(entityCode)}</span>` : ''}
            </td>
            <td><span class="category">${this.escapeHtml(item.categoryName || 'Course')}</span></td>
            <td class="amount">&#8377;${this.escapeHtml(this.formatAmount(item.price))}</td>
          </tr>
        `;
      })
      .join('');

    const orderReference =
      invoice.orderReference || invoice.razorpayOrderId || `Order #${invoice.orderId}`;
    const paymentMode = this.paymentMethodLabel(invoice);
    const entityCode = invoice.entityCode || '';
    const logoUrl = this.invoiceLogoUrl();

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(invoice.invoiceNo || 'Invoice')}</title>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      color: #172033;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      margin: 0;
    }
    .invoice {
      border: 1px solid #dbe4f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .masthead {
      align-items: center;
      background: #172033;
      color: #fff;
      display: flex;
      justify-content: space-between;
      padding: 24px 28px;
    }
    .brand {
      align-items: center;
      display: flex;
      gap: 12px;
    }
    .brand-mark {
      align-items: center;
      background: #fff;
      border-radius: 8px;
      box-sizing: border-box;
      color: #2458d3;
      display: inline-flex;
      font-size: 18px;
      font-weight: 900;
      height: 46px;
      justify-content: center;
      object-fit: contain;
      padding: 4px;
      width: 46px;
    }
    .brand strong,
    .brand span,
    .brand small {
      display: block;
    }
    .brand strong {
      color: #fff;
      font-size: 22px;
      line-height: 1;
    }
    .brand span,
    .brand small {
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 700;
      margin-top: 4px;
    }
    .status {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 10px 14px;
      text-align: right;
    }
    .status span,
    .label {
      color: #667085;
      display: block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .status span {
      color: rgba(255, 255, 255, 0.72);
    }
    .status strong {
      color: #fff;
      display: block;
      font-size: 18px;
      margin-top: 4px;
      text-transform: capitalize;
    }
    .headline,
    .meta,
    .items,
    .summary-wrap,
    .note {
      padding: 24px 28px;
    }
    .headline {
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      gap: 24px;
    }
    h1 {
      font-size: 38px;
      line-height: 1;
      margin: 8px 0 10px;
    }
    .invoice-no {
      color: #2458d3;
      font-size: 15px;
      font-weight: 900;
    }
    .total-box {
      background: #f8fafc;
      border: 1px solid #dbe4f0;
      border-radius: 8px;
      min-width: 210px;
      padding: 16px 18px;
      text-align: right;
    }
    .total-box strong {
      display: block;
      font-size: 28px;
      line-height: 1;
      margin-top: 8px;
    }
    .entity-code {
      background: #f1f7fc;
      border: 1px solid #c7dbea;
      border-radius: 999px;
      color: #34536c;
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      margin-left: 8px;
      padding: 3px 9px;
    }
    .meta {
      background: #f6f8fb;
      border-bottom: 1px solid #e2e8f0;
      display: grid;
      gap: 14px;
      grid-template-columns: 0.9fr 1.1fr;
    }
    .panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .panel strong {
      display: block;
      font-size: 17px;
      margin-top: 8px;
    }
    .panel p {
      color: #64748b;
      margin: 5px 0 0;
    }
    .details {
      display: grid;
      gap: 10px 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 10px;
    }
    .details dt {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
      margin: 0 0 3px;
      text-transform: uppercase;
    }
    .details dd {
      font-weight: 800;
      margin: 0;
      overflow-wrap: anywhere;
    }
    table {
      border: 1px solid #dbe4f0;
      border-collapse: collapse;
      width: 100%;
    }
    th,
    td {
      border-bottom: 1px solid #dbe4f0;
      padding: 14px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      color: #596579;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }
    th:last-child,
    td.amount {
      text-align: right;
    }
    td strong {
      display: block;
    }
    .category {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
    }
    .summary {
      border: 1px solid #dbe4f0;
      border-radius: 8px;
      margin-left: auto;
      max-width: 340px;
      overflow: hidden;
    }
    .summary div {
      align-items: center;
      display: flex;
      justify-content: space-between;
      padding: 14px 16px;
    }
    .summary div + div {
      background: #f8fafc;
      border-top: 1px solid #dbe4f0;
    }
    .summary strong {
      font-size: 20px;
    }
    .note {
      background: #eef8f2;
      border: 1px solid #ccebd8;
      border-radius: 8px;
      color: #12805c;
      font-weight: 800;
      margin: 0 28px 28px;
      padding: 14px 16px;
    }
    @media print {
      .invoice { break-inside: avoid; }
      .masthead,
      .headline,
      .meta,
      .items,
      .summary,
      .note {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="invoice">
    <section class="masthead">
      <div class="brand">
        <img class="brand-mark" src="${this.escapeHtml(logoUrl)}" alt="ICETL logo">
        <div>
          <strong>${this.escapeHtml(invoice.company?.name || 'ICETL')}</strong>
          <span>${this.escapeHtml(invoice.company?.subtitle || 'Ice Technology Lab')}</span>
          <small>${this.escapeHtml(invoice.company?.email || 'support@icetl.com')}</small>
        </div>
      </div>
      <div class="status">
        <span>Payment Status</span>
        <strong>${this.escapeHtml(invoice.status || 'Paid')}</strong>
      </div>
    </section>

    <section class="headline">
      <div>
        <span class="label">Payment Invoice</span>
        <h1>Invoice</h1>
        <span class="invoice-no">${this.escapeHtml(invoice.invoiceNo || 'Invoice')}</span>
        ${entityCode ? `<span class="entity-code">${this.escapeHtml(entityCode)}</span>` : ''}
      </div>
      <div class="total-box">
        <span class="label">Total Paid</span>
        <strong>&#8377;${this.escapeHtml(this.formatAmount(invoice.totalAmount))}</strong>
      </div>
    </section>

    <section class="meta">
      <div class="panel">
        <span class="label">Billed To</span>
        <strong>${this.escapeHtml(invoice.customer.name || 'Customer')}</strong>
        <p>${this.escapeHtml(invoice.customer.email || 'Email not available')}</p>
        ${invoice.customer.phone ? `<p>${this.escapeHtml(invoice.customer.phone)}</p>` : ''}
      </div>
      <div class="panel">
        <span class="label">Payment Details</span>
        <dl class="details">
          <div>
            <dt>Order Date</dt>
            <dd>${this.escapeHtml(this.formatDate(invoice.orderDate))}</dd>
          </div>
          <div>
            <dt>Order Ref</dt>
            <dd>${this.escapeHtml(orderReference)}</dd>
          </div>
          <div>
            <dt>Transaction No</dt>
            <dd>${this.escapeHtml(this.paymentIdentifier(invoice))}</dd>
          </div>
          ${
            paymentMode
              ? `<div>
                  <dt>Payment Mode</dt>
                  <dd>${this.escapeHtml(paymentMode)}</dd>
                </div>`
              : ''
          }
        </dl>
      </div>
    </section>

    <section class="items">
      <table>
        <thead>
          <tr>
            <th>Entity</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </section>

    <section class="summary-wrap">
      <div class="summary">
        <div>
          <span class="label">Subtotal</span>
          <strong>&#8377;${this.escapeHtml(this.formatAmount(invoice.subtotal))}</strong>
        </div>
        <div>
          <span class="label">Total Paid</span>
          <strong>&#8377;${this.escapeHtml(this.formatAmount(invoice.totalAmount))}</strong>
        </div>
      </div>
    </section>

    <p class="note">This invoice is generated for a verified payment record.</p>
  </main>
</body>
</html>`;
  }

  private invoiceLogoUrl(): string {
    return new URL(this.invoiceLogoPath, document.baseURI).href;
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
