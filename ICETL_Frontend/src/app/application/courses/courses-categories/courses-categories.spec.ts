import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoursesCategories } from './courses-categories';

describe('CoursesCategories', () => {
  let component: CoursesCategories;
  let fixture: ComponentFixture<CoursesCategories>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoursesCategories]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoursesCategories);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
