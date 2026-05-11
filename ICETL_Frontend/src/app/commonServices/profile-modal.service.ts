import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProfileModalService {
  private readonly openModalSubject = new Subject<void>();

  readonly openModal$ = this.openModalSubject.asObservable();

  open(): void {
    this.openModalSubject.next();
  }
}
