import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { PaymentService } from '../../services/payment';

import { MySeminar } from './my-seminar';

describe('MySeminar', () => {
  let component: MySeminar;
  let fixture: ComponentFixture<MySeminar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySeminar],
      providers: [
        provideRouter([]),
        {
          provide: PaymentService,
          useValue: {
            getMyPrograms: () => of({ success: true, message: '', data: [] }),
          },
        },
        {
          provide: AlertHelperService,
          useValue: {
            error: () => Promise.resolve(),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MySeminar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
