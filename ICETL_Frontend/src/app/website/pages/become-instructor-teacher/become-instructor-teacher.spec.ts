import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BecomeInstructorTeacher } from './become-instructor-teacher';

describe('BecomeInstructorTeacher', () => {
  let component: BecomeInstructorTeacher;
  let fixture: ComponentFixture<BecomeInstructorTeacher>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BecomeInstructorTeacher]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BecomeInstructorTeacher);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
