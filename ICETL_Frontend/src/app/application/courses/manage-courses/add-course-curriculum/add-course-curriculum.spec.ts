import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCourseCurriculum } from './add-course-curriculum';

describe('AddCourseCurriculum', () => {
  let component: AddCourseCurriculum;
  let fixture: ComponentFixture<AddCourseCurriculum>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCourseCurriculum]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCourseCurriculum);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
