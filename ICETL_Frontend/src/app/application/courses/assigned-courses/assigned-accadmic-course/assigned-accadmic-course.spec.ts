import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignedAccadmicCourse } from './assigned-accadmic-course';

describe('AssignedAccadmicCourse', () => {
  let component: AssignedAccadmicCourse;
  let fixture: ComponentFixture<AssignedAccadmicCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignedAccadmicCourse]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignedAccadmicCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
