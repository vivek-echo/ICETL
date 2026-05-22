import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseCart, CourseCartItem } from '../services/cart';

@Component({
  selector: 'app-your-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './your-cart.html',
  styleUrl: './your-cart.scss',
})
export class YourCart implements OnInit {
  private readonly indianNumberFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly skeletonRows = [1, 2, 3];
  readonly discountPercent = 10;
  readonly taxPercent = 18;
  items: CourseCartItem[] = [];
  loading = false;
  clearing = false;

  constructor(
    private cartService: CourseCart,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cartService.items$.subscribe((items) => {
      this.items = items;
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
    await this.cartService.removeItem(courseId);
    this.cdr.detectChanges();
  }

  async clearCart(): Promise<void> {
    this.clearing = true;
    this.cdr.detectChanges();

    try {
      await this.cartService.clearCart();
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

    const unit = item.durationUnit === 'months' ? 'Month(s)' : 'Week(s)';

    return `${item.duration} ${unit}`;
  }

  formatAmount(value: number | string | null): string {
    return this.indianNumberFormatter.format(Number(value) || 0);
  }

  get total(): number {
    return this.cartService.getTotal();
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
}
