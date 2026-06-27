import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignedSeminar } from './assigned-seminar';

describe('AssignedSeminar', () => {
  let component: AssignedSeminar;
  let fixture: ComponentFixture<AssignedSeminar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignedSeminar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignedSeminar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
