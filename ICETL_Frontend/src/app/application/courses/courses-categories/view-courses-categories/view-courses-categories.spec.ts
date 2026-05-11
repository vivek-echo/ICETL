import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewCoursesCategories } from './view-courses-categories';

describe('ViewCoursesCategories', () => {
  let component: ViewCoursesCategories;
  let fixture: ComponentFixture<ViewCoursesCategories>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewCoursesCategories]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewCoursesCategories);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
