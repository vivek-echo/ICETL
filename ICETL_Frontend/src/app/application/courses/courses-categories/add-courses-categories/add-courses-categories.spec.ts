import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCoursesCategories } from './add-courses-categories';

describe('AddCoursesCategories', () => {
  let component: AddCoursesCategories;
  let fixture: ComponentFixture<AddCoursesCategories>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCoursesCategories]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCoursesCategories);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
