import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewCourses } from './view-courses';

describe('ViewCourses', () => {
  let component: ViewCourses;
  let fixture: ComponentFixture<ViewCourses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewCourses]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewCourses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
