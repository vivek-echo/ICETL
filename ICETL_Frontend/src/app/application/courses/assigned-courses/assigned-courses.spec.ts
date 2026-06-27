import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignedCourses } from './assigned-courses';

describe('AssignedCourses', () => {
  let component: AssignedCourses;
  let fixture: ComponentFixture<AssignedCourses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignedCourses]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignedCourses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
