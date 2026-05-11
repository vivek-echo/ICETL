import { Component } from '@angular/core';

@Component({
  selector: 'app-view-courses',
  imports: [],
  templateUrl: './view-courses.html',
  styleUrl: './view-courses.scss',
})
export class ViewCourses {
  metrics = [
    {
      label: 'Total Courses',
      value: '128',
      note: 'Active learning programs',
      icon: 'feather-book-open',
    },
    {
      label: 'Total Students',
      value: '12K',
      note: 'Enrolled students',
      icon: 'feather-users',
    },
    {
      label: 'Revenue',
      value: '$48K',
      note: 'This month earnings',
      icon: 'feather-dollar-sign',
    },
    {
      label: 'Published',
      value: '96',
      note: 'Live courses',
      icon: 'feather-check-circle',
    },
  ];

  courses = [
    {
      id: 1,
      title: 'React Front To Back',
      category: 'Languages',
      instructor: 'Patrick',
      lessons: 20,
      students: 40,
      reviews: 15,
      price: 60,
      oldPrice: 120,
      discount: '-50%',
      thumbnail: 'https://placehold.co/710x488',
      description: 'React Js long fact that a reader will be distracted by the readable.',
    },
    {
      id: 2,
      title: 'Advanced UI/UX Design',
      category: 'UI/UX',
      instructor: 'John',
      lessons: 32,
      students: 80,
      reviews: 28,
      price: 75,
      oldPrice: 140,
      discount: '-30%',
      thumbnail: 'https://placehold.co/710x488',
      description: 'Master modern UI/UX principles and create amazing interfaces.',
    },
    {
      id: 3,
      title: 'Angular Masterclass',
      category: 'Web Development',
      instructor: 'Sarah',
      lessons: 45,
      students: 120,
      reviews: 40,
      price: 90,
      oldPrice: 180,
      discount: '-40%',
      thumbnail: 'https://placehold.co/710x488',
      description: 'Complete Angular course with routing, APIs, authentication and UI.',
    },
  ];
}
