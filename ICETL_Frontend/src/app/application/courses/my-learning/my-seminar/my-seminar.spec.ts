import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySeminar } from './my-seminar';

describe('MySeminar', () => {
  let component: MySeminar;
  let fixture: ComponentFixture<MySeminar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySeminar]
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
