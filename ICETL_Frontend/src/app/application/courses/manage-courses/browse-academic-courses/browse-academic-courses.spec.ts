import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { CourseCart } from '../../services/cart';
import { Course } from '../../services/course';
import { BrowseAcademicCourses } from './browse-academic-courses';

describe('BrowseAcademicCourses', () => {
  let component: BrowseAcademicCourses;
  let fixture: ComponentFixture<BrowseAcademicCourses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseAcademicCourses],
      providers: [
        {
          provide: Course,
          useValue: {
            getCourseCategories: () => of({ status: true, data: [] }),
            getAllOfflineCourses: () =>
              of({
                status: true,
                data: [],
                meta: {
                  currentPage: 1,
                  perPage: 10,
                  total: 0,
                  lastPage: 1,
                  from: null,
                  to: null,
                },
                summary: {
                  totalCourses: 0,
                  activeCourses: 0,
                  inactiveCourses: 0,
                  upcomingCourses: 0,
                  ongoingCourses: 0,
                  completedCourses: 0,
                },
              }),
          },
        },
        {
          provide: CourseCart,
          useValue: {
            items$: of([]),
            loadCart: () => Promise.resolve([]),
            addItem: () => Promise.resolve([]),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate'),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrowseAcademicCourses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
