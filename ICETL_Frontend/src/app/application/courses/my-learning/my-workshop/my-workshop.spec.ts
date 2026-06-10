import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { PaymentService } from '../../services/payment';


import { MyWorkshop } from './my-workshop';

describe('MyWorkshop', () => {
  let component: MyWorkshop;
  let fixture: ComponentFixture<MyWorkshop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyWorkshop],
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

    fixture = TestBed.createComponent(MyWorkshop);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
