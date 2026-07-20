import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CourseCart, CourseCartItem } from '../courses/services/cart';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { lastValueFrom } from 'rxjs/internal/lastValueFrom';
import { PaymentService } from '../courses/services/payment';
import { NgxSpinnerService } from 'ngx-spinner';
import { Router } from '@angular/router';
declare var Razorpay: any;
@Component({
  selector: 'app-your-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './your-cart.html',
  styleUrl: './your-cart.scss',
})
export class YourCart implements OnInit {
  private selectionInitialized = false;
  private readonly indianNumberFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly skeletonRows = [1, 2, 3];
  readonly discountPercent = 0;
  readonly taxPercent = 0;
  items: CourseCartItem[] = [];
  selectedCourseIds = new Set<number>();
  loading = false;
  clearing = false;

  constructor(
    private cartService: CourseCart,
    private cdr: ChangeDetectorRef,
    private alertHelper: AlertHelperService,
    private paymentService: PaymentService,
    private spinner: NgxSpinnerService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cartService.items$.subscribe((items) => {
      this.items = items;
      this.syncSelectedItems(items);
      this.loading = false;
      this.cdr.detectChanges();
    });

    void this.loadCart();
  }

  async loadCart(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      await this.cartService.loadCart();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async removeItem(courseId: number): Promise<void> {
    this.selectedCourseIds.delete(courseId);
    await this.cartService.removeItem(courseId);
    this.cdr.detectChanges();
  }

  async clearCart(): Promise<void> {
    this.clearing = true;
    this.cdr.detectChanges();

    try {
      await this.cartService.clearCart();
      this.selectedCourseIds.clear();
    } finally {
      this.clearing = false;
      this.cdr.detectChanges();
    }
  }

  saveForLater(courseId: number): void {
    void this.removeItem(courseId);
  }

  courseImage(item: CourseCartItem): string {
    return item.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(item: CourseCartItem): void {
    item.thumbnailUrl = null;
  }

  getDurationLabel(item: CourseCartItem): string {
    if (!item.duration) {
      return 'N/A';
    }

    const unit = Number(item.durationUnit) === 2 ? 'Month(s)' : 'Week(s)';

    return `${item.duration} ${unit}`;
  }

  formatAmount(value: number | string | null): string {
    return this.indianNumberFormatter.format(Number(value) || 0);
  }

  isZeroAmount(value: number | string | null): boolean {
    const amount = Number(value);

    return Number.isFinite(amount) && amount <= 0;
  }

  isSelected(courseId: number): boolean {
    return this.selectedCourseIds.has(courseId);
  }

  toggleItemSelection(courseId: number, checked: boolean): void {
    if (checked) {
      this.selectedCourseIds.add(courseId);
    } else {
      this.selectedCourseIds.delete(courseId);
    }

    this.cdr.detectChanges();
  }

  toggleAllSelection(checked: boolean): void {
    this.selectedCourseIds = checked
      ? new Set(this.items.map((item) => item.id))
      : new Set<number>();
    this.cdr.detectChanges();
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.selectedCount === this.items.length;
  }

  get partiallySelected(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  get selectedItems(): CourseCartItem[] {
    return this.items.filter((item) => this.selectedCourseIds.has(item.id));
  }

  get selectedCount(): number {
    return this.selectedCourseIds.size;
  }

  get total(): number {
    return this.selectedItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
  }

  get subtotal(): number {
    return this.total;
  }

  get discount(): number {
    return Math.round((this.subtotal * this.discountPercent) / 100);
  }

  get tax(): number {
    return Math.round(((this.subtotal - this.discount) * this.taxPercent) / 100);
  }

  get finalTotal(): number {
    return Math.max(this.subtotal - this.discount + this.tax, 0);
  }

  get isFreeCheckout(): boolean {
    return this.selectedCount > 0 && this.finalTotal <= 0;
  }

  get checkoutActionLabel(): string {
    return this.isFreeCheckout ? 'Enroll Free' : 'Purchase Selected';
  }

  async checkout(): Promise<void> {
    if (this.selectedCount === 0) {
      await this.alertHelper.warning(
        'Please select at least one course to purchase.',
        'No Course Selected',
      );

      return;
    }

    const confirmed = await this.alertHelper.confirm(
      this.checkoutConfirmationMessage(),

      this.isFreeCheckout ? 'Free Enrollment' : 'Checkout',
      this.isFreeCheckout ? 'Enroll' : 'Proceed',
      'Cancel',
    );

    if (!confirmed) {
      return;
    }

    try {
      this.spinner.show();

      const selectedCourseIds = this.selectedItems.map((item) => item.id);

      const payload = {
        courseIds: selectedCourseIds,
      };

      const response: any = await lastValueFrom(this.paymentService.checkoutInit(payload));

      console.log('Checkout Init Response', response);

      if (!response.success) {
        await this.alertHelper.error(response.message || 'Checkout failed', 'Error');

        return;
      }

      if (response.paymentRequired === false || response.freeEnrollment === true) {
        localStorage.removeItem('checkoutData');

        await this.alertHelper.success(
          response.message || 'Enrollment completed successfully.',
          'Enrollment Complete',
        );

        await this.cartService.loadCart();
        void this.router.navigate(['/application/courses/myLearning']);
        return;
      }

      /*
      Save order information locally
      for next payment phase
    */

      const checkoutData = {
        orderId: response.orderId,

        totalAmount: response.totalAmount,

        courses: response.courses,
      };

      localStorage.setItem('checkoutData', JSON.stringify(checkoutData));

      await this.alertHelper.success(
        'Order created successfully. Ready for payment.',

        'Checkout Ready',
      );

      let paymentCompleted = false;

      const user = this.getStoredUser();
      const options = {
        key: response.razorpayKey,

        amount: response.amountInPaise,

        currency: 'INR',

        name: 'ICETL',

        description: `${this.selectedCount} course${this.selectedCount === 1 ? '' : 's'} purchase`,

        order_id: response.razorpayOrderId,

        handler: async (paymentResponse: any) => {
          paymentCompleted = true;
          console.log('Payment Success', paymentResponse);

          try {
            this.spinner.show();

            const payload = {
              razorpay_payment_id: paymentResponse.razorpay_payment_id,

              razorpay_order_id: paymentResponse.razorpay_order_id,

              razorpay_signature: paymentResponse.razorpay_signature,

              orderId: response.orderId,
            };

            const verifyResponse: any = await lastValueFrom(
              this.paymentService.verifyPayment(payload),
            );

            console.log('Verify Payment Response', verifyResponse);

            if (verifyResponse.success) {
              await this.alertHelper.success(
                'Payment successful. Course unlocked.',

                'Payment Success',
              );

              localStorage.removeItem('checkoutData');
              await this.cartService.loadCart();
              void this.router.navigate(['/application/courses/myLearning']);
            } else {
              await this.alertHelper.error(
                verifyResponse.message || 'Payment verification failed',

                'Verification Failed',
              );
            }
          } catch (error: any) {
            console.error(error);

            await this.alertHelper.error(
              error?.error?.message || 'Payment verification failed',

              'Error',
            );
          } finally {
            this.spinner.hide();
          }
        },

        prefill: {
          name: user.name || '',

          email: user.email || '',

          contact: user.phone || '',
        },

        notes: {
          orderId: response.orderId,
        },

        theme: {
          color: '#6366f1',
        },

        modal: {
          ondismiss: async () => {
            if (paymentCompleted) {
              return;
            }

            paymentCompleted = true;
            await this.recordPaymentFailure(
              response.orderId,
              response.razorpayOrderId,
              null,
              'cancelled',
              'Payment was cancelled. You can retry with a fresh checkout.',
              true,
            );
          },
        },
      };

      if (typeof Razorpay === 'undefined') {
        await this.recordPaymentFailure(
          response.orderId,
          response.razorpayOrderId,
          null,
          'failed',
          'Payment gateway is not loaded. Please refresh and try again.',
          true,
        );
        return;
      }

      const razorpay = new Razorpay(options);

      razorpay.on('payment.failed', async (failureResponse: any) => {
        paymentCompleted = true;
        const error = failureResponse?.error ?? {};
        const reason = error.description || error.reason || error.code || 'Payment failed';

        await this.recordPaymentFailure(
          response.orderId,
          error.metadata?.order_id || response.razorpayOrderId,
          error.metadata?.payment_id || null,
          'failed',
          reason,
          true,
        );
      });

      razorpay.open();
    } catch (error: any) {
      console.error(error);

      await this.alertHelper.error(
        error?.error?.message || 'Unable to initialize checkout',

        'Checkout Failed',
      );
    } finally {
      this.spinner.hide();
    }
  }

  private async recordPaymentFailure(
    orderId: number,
    razorpayOrderId: string | null,
    razorpayPaymentId: string | null,
    status: 'failed' | 'cancelled',
    reason: string,
    showMessage: boolean,
  ): Promise<void> {
    try {
      await lastValueFrom(
        this.paymentService.markPaymentFailure({
          orderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          status,
          reason,
        }),
      );

      localStorage.removeItem('checkoutData');

      if (showMessage) {
        await this.alertHelper.error(
          reason,
          status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed',
        );
      }
    } catch (error: any) {
      console.error(error);

      if (showMessage) {
        await this.alertHelper.error(
          error?.error?.message || 'Payment failed, but the failure could not be recorded.',
          'Payment Failed',
        );
      }
    }
  }

  private syncSelectedItems(items: CourseCartItem[]): void {
    if (items.length === 0) {
      this.selectedCourseIds.clear();
      this.selectionInitialized = false;
      return;
    }

    const availableIds = new Set(items.map((item) => item.id));

    if (!this.selectionInitialized) {
      this.selectedCourseIds = new Set(items.map((item) => item.id));
      this.selectionInitialized = true;
      return;
    }

    const selectedIds = [...this.selectedCourseIds].filter((id) => availableIds.has(id));
    this.selectedCourseIds = new Set(selectedIds);
  }

  private checkoutConfirmationMessage(): string {
    const courseLabel = `selected course${this.selectedCount === 1 ? '' : 's'}`;

    if (this.isFreeCheckout) {
      return `Enroll in ${this.selectedCount} ${courseLabel} for free?`;
    }

    return `Purchase ${this.selectedCount} ${courseLabel} for Rs. ${this.formatAmount(this.finalTotal)}?`;
  }

  private getStoredUser(): { name?: string; email?: string; phone?: string } {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || '{}') ?? {};
    } catch {
      return {};
    }
  }
}
