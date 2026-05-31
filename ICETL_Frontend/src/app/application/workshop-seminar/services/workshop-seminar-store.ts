import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export type WorkshopSeminarType = 'workshop' | 'seminar';

export interface WorkshopSeminarPayload {
  type: WorkshopSeminarType;
  title: string;
  topic: string;
  venue: string;
  city: string;
  eventDate: string;
  startDate?: string;
  endDate?: string | null;
  startTime: string;
  endTime: string | null;
  speakerName: string;
  capacity?: number;
  price: number;
  description: string;
  takeaways: string[];
  status: number;
}

export interface WorkshopSeminarItem extends WorkshopSeminarPayload {
  id: number;
  startDate: string;
  endDate: string | null;
  capacity: number;
  createdById: number | null;
  createdByName: string;
  createdOn: string;
  updatedOn: string;
}

interface StoredAuthUser {
  id?: number | string | null;
  name?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class WorkshopSeminarStore {
  private readonly storageKey = 'icetl_workshop_seminar_items';
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  addItem(payload: WorkshopSeminarPayload): WorkshopSeminarItem {
    const items = this.getItems();
    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();
    const item = this.normalizeItem({
      ...payload,
      id: Date.now() + Math.floor(Math.random() * 1000),
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdOn: now,
      updatedOn: now,
    });

    this.saveItems([item, ...items]);

    return item;
  }

  getItems(type?: WorkshopSeminarType): WorkshopSeminarItem[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const rawItems = localStorage.getItem(this.storageKey);
      const items = rawItems ? JSON.parse(rawItems) : [];
      const normalizedItems = Array.isArray(items)
        ? items.map((item) => this.normalizeItem(item))
        : [];

      return type ? normalizedItems.filter((item) => item.type === type) : normalizedItems;
    } catch {
      return [];
    }
  }

  getMyItems(type: WorkshopSeminarType): WorkshopSeminarItem[] {
    const currentUser = this.getCurrentUser();
    const items = this.getItems(type);

    if (!currentUser.id) {
      return items;
    }

    return items.filter((item) => item.createdById === currentUser.id);
  }

  deleteItem(itemId: number): void {
    this.saveItems(this.getItems().filter((item) => item.id !== itemId));
  }

  updateItemStatus(itemId: number, status: number): void {
    const items = this.getItems().map((item) =>
      item.id === itemId
        ? {
            ...item,
            status,
            updatedOn: new Date().toISOString(),
          }
        : item,
    );

    this.saveItems(items);
  }

  private saveItems(items: WorkshopSeminarItem[]): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  private getCurrentUser(): { id: number | null; name: string } {
    if (!this.isBrowser) {
      return { id: null, name: 'Current User' };
    }

    try {
      const rawUser = localStorage.getItem('auth_user');
      const user = rawUser ? (JSON.parse(rawUser) as StoredAuthUser) : null;
      const parsedId = Number(user?.id);

      return {
        id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null,
        name: user?.name?.trim() || 'Current User',
      };
    } catch {
      return { id: null, name: 'Current User' };
    }
  }

  private normalizeItem(value: Partial<WorkshopSeminarItem>): WorkshopSeminarItem {
    return {
      id: Number(value.id) || Date.now(),
      type: value.type === 'seminar' ? 'seminar' : 'workshop',
      title: `${value.title || ''}`.trim(),
      topic: `${value.topic || ''}`.trim(),
      venue: `${value.venue || ''}`.trim(),
      city: `${value.city || ''}`.trim(),
      eventDate: `${value.eventDate || value.startDate || ''}`.trim(),
      startDate: `${value.startDate || value.eventDate || ''}`.trim(),
      endDate: value.endDate ? `${value.endDate}`.trim() : null,
      startTime: `${value.startTime || ''}`.trim(),
      endTime: value.endTime ? `${value.endTime}`.trim() : null,
      speakerName: `${value.speakerName || 'Speaker'}`.trim(),
      capacity: Number(value.capacity) || 0,
      price: Number(value.price) || 0,
      description: `${value.description || ''}`.trim(),
      takeaways: Array.isArray(value.takeaways)
        ? value.takeaways.map((item) => `${item}`.trim()).filter((item) => item.length > 0)
        : [],
      status: Number(value.status) === 0 ? 0 : 1,
      createdById:
        value.createdById === null || value.createdById === undefined
          ? null
          : Number(value.createdById) || null,
      createdByName: `${value.createdByName || 'Current User'}`.trim(),
      createdOn: `${value.createdOn || new Date().toISOString()}`,
      updatedOn: `${value.updatedOn || value.createdOn || new Date().toISOString()}`,
    };
  }
}
