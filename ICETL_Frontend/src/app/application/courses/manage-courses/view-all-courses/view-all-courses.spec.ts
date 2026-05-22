import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewAllCourses } from './view-all-courses';

describe('ViewAllCourses', () => {
  let component: ViewAllCourses;
  let fixture: ComponentFixture<ViewAllCourses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewAllCourses],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewAllCourses);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
