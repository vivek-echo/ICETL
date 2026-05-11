import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageCourses } from './manage-courses';

describe('ManageCourses', () => {
  let component: ManageCourses;
  let fixture: ComponentFixture<ManageCourses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageCourses]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageCourses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
