import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { lastValueFrom, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export interface CourseCartItem {
  cartId?: number;
  id: number;
  title: string;
  categoryName: string;
  instructorName: string;
  duration: number | string | null;
  durationUnit: string | null;
  price: number | string;
  oldPrice: number | string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CourseCart {
  private readonly API_URL = environment.apiUrl;
  private readonly itemsSubject = new BehaviorSubject<CourseCartItem[]>([]);
  readonly items$ = this.itemsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getItems(): CourseCartItem[] {
    return this.itemsSubject.value;
  }

  async loadCart(): Promise<CourseCartItem[]> {
    const response = await this.requestCart('getCartItems', {});

    return response;
  }

  async addItem(course: CourseCartItem): Promise<CourseCartItem[]> {
    if (this.hasItem(course.id)) {
      return this.getItems();
    }

    return this.requestCart('addToCart', { courseId: course.id });
  }

  async removeItem(courseId: number): Promise<CourseCartItem[]> {
    const previousItems = this.getItems();
    const optimisticItems = previousItems.filter((item) => item.id !== courseId);

    this.itemsSubject.next(optimisticItems);

    return this.requestCart('removeFromCart', { courseId }, (items) =>
      items.filter((item) => item.id !== courseId),
    );
  }

  async clearCart(): Promise<CourseCartItem[]> {
    return this.requestCart('clearCart', {});
  }

  hasItem(courseId: number): boolean {
    return this.getItems().some((item) => item.id === courseId);
  }

  getTotal(): number {
    return this.getItems().reduce((total, item) => total + (Number(item.price) || 0), 0);
  }

  private async requestCart(
    endpoint: string,
    payload: object,
    fallbackItems?: (items: CourseCartItem[]) => CourseCartItem[],
  ): Promise<CourseCartItem[]> {
    try {
      const response = await lastValueFrom(
        this.http
          .post<CartResponse>(`${this.API_URL}/${endpoint}`, payload, {
            context: new HttpContext().set(SKIP_SPINNER, true),
          })
          .pipe(timeout(15000)),
      );
      const responseItems = response.data ?? this.getItems();
      const items = response.status ? fallbackItems?.(responseItems) ?? responseItems : this.getItems();

      this.itemsSubject.next(items);

      return items;
    } catch (error) {
      console.error(error);
      return this.getItems();
    }
  }
}

interface CartResponse {
  status: boolean;
  message: string;
  data: CourseCartItem[];
}
