import { afterNextRender, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { Course } from '../../../application/courses/services/course';
interface BannerCourse {
  title: string;
  image: string;
  badge: string;
  lessons: number;
  students: number;
  reviews: number;
  price: number;
  originalPrice: number;
  description: string;
}

interface CategoryBox {
  id: number;
  title: string;
  image: string;
  courseCount: number;
}

interface CourseCategoryResponseItem {
  id: number;
  categoryName: string;
  iconUrl?: string | null;
  icon?: string | null;
  courseCount?: number | null;
}

interface CourseCategoryResponse {
  status: boolean;
  data: CourseCategoryResponseItem[];
}

interface PopularCourse {
  title: string;
  image: string;
  badge: string;
  lessons: number;
  students: number;
  reviews: number;
  description: string;
  author: string;
  authorImage: string;
  category: string;
  price: number;
  originalPrice: number;
  actionLabel: string;
  actionIcon: string;
}

interface AboutFeature {
  title: string;
  description: string;
  iconClass: string;
  backgroundClass: string;
}

interface CounterItem {
  image: string;
  value: string;
  label: string;
  extraClasses?: string;
}

interface TestimonialItem {
  icon: string;
  quote: string;
  avatar: string;
  name: string;
  role: string;
}

interface EventItem {
  image: string;
  dayMonth: string;
  year: string;
  location: string;
  time: string;
  title: string;
}

interface Teacher {
  id: string;
  image: string;
  name: string;
  designation: string;
  location: string;
  description: string;
  phone: string;
  email: string;
}

interface BlogItem {
  image: string;
  title: string;
  description?: string;
  buttonLabel: string;
}

interface NewsletterCounter {
  value: string;
  title: string;
  subtitle: string;
  extraClasses?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  readonly courseRoute = '/courses';
  readonly dashboardRoute = '/dashboard';
  constructor(private courseService: Course) {
    afterNextRender(() => {
      void this.getCourseCategories();
    });
  }

  readonly heroCourses: BannerCourse[] = [
    {
      title: 'Industry-Focused IT Training',
      image: 'assets/images/course/course-011.png',
      badge: 'Internship',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 70,
      originalPrice: 120,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
    {
      title: 'Professional Certification Programs',
      image: 'assets/images/course/classic-lms-011.png',
      badge: 'Internship',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 64,
      originalPrice: 99,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
    {
      title: 'Live Projects and Internships',
      image: 'assets/images/course/course-online-02.png',
      badge: 'Internship',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 80,
      originalPrice: 140,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
  ];
  contactRoute = '/contact';
  readonly activeHeroIndex = signal(0);
  readonly activeHeroCourse = computed(
    () => this.heroCourses[this.activeHeroIndex()] ?? this.heroCourses[0],
  );

  readonly categoryBoxes = signal<CategoryBox[]>([]);

  async getCourseCategories(): Promise<void> {
    const payload = {
      search: '',
      status: 1,
    };

    try {
      const response: CourseCategoryResponse = await lastValueFrom(
        this.courseService.getCourseCategories(payload),
      );

      if (response.status) {
        this.categoryBoxes.set(
          (response.data ?? []).map((category) => ({
            id: category.id,
            title: category.categoryName,
            image: category.iconUrl || 'assets/images/category/default.png',
            courseCount: category.courseCount ?? 0,
          })),
        );
      } else {
        this.categoryBoxes.set([]);
      }
    } catch (error) {
      console.error(error);
      this.categoryBoxes.set([]);
    }
  }

  readonly popularCourses: PopularCourse[] = [
    {
      title: 'Full Stack Development',
      image: 'assets/images/course/course-03.png',
      badge: '-37%',
      lessons: 18,
      students: 240,
      reviews: 46,
      description:
        'Build modern frontend and backend applications with real-world project training.',
      author: 'Akhil Mathew',
      authorImage: 'assets/images/client/avatar-02.png',
      category: 'Web Development',
      price: 69,
      originalPrice: 110,
      actionLabel: 'Enroll Now',
      actionIcon: 'feather-arrow-right',
    },
    {
      title: 'Python Programming',
      image: 'assets/images/course/course-01.png',
      badge: '-37%',
      lessons: 16,
      students: 278,
      reviews: 41,
      description:
        'Learn Python fundamentals, automation, problem solving, and practical application development.',
      author: 'Nithin George',
      authorImage: 'assets/images/client/avatar-02.png',
      category: 'Programming',
      price: 64,
      originalPrice: 102,
      actionLabel: 'Enroll Now',
      actionIcon: 'feather-arrow-right',
    },
    {
      title: 'Artificial Intelligence',
      image: 'assets/images/course/course-online-01.png',
      badge: '-35%',
      lessons: 20,
      students: 198,
      reviews: 34,
      description: 'Understand intelligent systems, AI concepts, and practical industry use cases.',
      author: 'Megha Raj',
      authorImage: 'assets/images/client/avatar-03.png',
      category: 'AI & Data Science',
      price: 79,
      originalPrice: 122,
      actionLabel: 'Enroll Now',
      actionIcon: 'feather-arrow-right',
    },
  ];
  readonly aboutFeatures: AboutFeature[] = [
    {
      title: 'Practical Learning Approach',
      description:
        'Learn through hands-on sessions, guided practice, and live project work that strengthens real-world technical skills.',
      iconClass: 'feather-heart',
      backgroundClass: 'bg-pink-opacity',
    },
    {
      title: 'Internships and Certification',
      description:
        'Build career confidence with internship-oriented training, professional certifications, and industry-ready skill development.',
      iconClass: 'feather-book',
      backgroundClass: 'bg-primary-opacity',
    },
  ];

  readonly communityCounters: CounterItem[] = [
    {
      image: 'assets/images/icons/counter-01.png',
      value: '500',
      label: 'Learners & counting',
    },
    {
      image: 'assets/images/icons/counter-02.png',
      value: '800',
      label: 'Courses & Video',
      extraClasses: 'mt--60 mt_md--30 mt_sm--30 mt_mobile--60',
    },
    {
      image: 'assets/images/icons/counter-03.png',
      value: '5000',
      label: 'Certified Students',
      extraClasses: 'mt_md--60 mt_sm--60',
    },
    {
      image: 'assets/images/icons/counter-04.png',
      value: '9000',
      label: 'Registered Enrolls',
      extraClasses: 'mt--60 mt_md--30 mt_sm--30 mt_mobile--60',
    },
  ];

  readonly testimonialRowOne: TestimonialItem[] = [
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'ICTEL gave me practical training with live projects that helped me understand real development workflows.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Aarav Menon',
      role: 'Full Stack Student',
    },
    {
      icon: 'assets/images/icons/google.png',
      quote:
        'The internship-focused learning experience improved my confidence and prepared me for professional IT work.',
      avatar: 'assets/images/testimonial/client-02.png',
      name: 'Nisha Reddy',
      role: 'Python Trainee',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'Working on live projects at ICTEL helped me build practical skills that I could showcase in interviews.',
      avatar: 'assets/images/testimonial/client-03.png',
      name: 'Rahul Das',
      role: 'Data Science Student',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'The trainers focused on hands-on learning, and that made the transition from classroom concepts to real tasks much easier.',
      avatar: 'assets/images/testimonial/client-04.png',
      name: 'Meera Joseph',
      role: 'Cloud Computing Learner',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'ICTEL supported my career growth with project-based training and guidance that matched current industry needs.',
      avatar: 'assets/images/testimonial/client-05.png',
      name: 'Karthik Iyer',
      role: 'Networking Student',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'The certification-oriented training gave me both technical knowledge and the confidence to apply for better roles.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Sneha Pillai',
      role: 'AI Program Student',
    },
    {
      icon: 'assets/images/icons/hubs.png',
      quote:
        'I gained real exposure through practical assignments and internship preparation sessions at ICTEL.',
      avatar: 'assets/images/testimonial/client-07.png',
      name: 'Vikram Nair',
      role: 'Ethical Hacking Student',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'The learning model combined theory, practice, and live project work in a way that felt relevant to the job market.',
      avatar: 'assets/images/testimonial/client-08.png',
      name: 'Ananya Suresh',
      role: 'Digital Marketing Trainee',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'My internship experience through ICTEL helped me understand workplace expectations and improve my technical skills.',
      avatar: 'assets/images/testimonial/client-06.png',
      name: 'Aditya Kumar',
      role: 'Software Development Student',
    },
  ];

  readonly testimonialRowTwo: TestimonialItem[] = [
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'ICTEL gave me practical training with live projects that helped me understand real development workflows.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Aarav Menon',
      role: 'Full Stack Student',
    },
    {
      icon: 'assets/images/icons/google.png',
      quote:
        'The internship-focused learning experience improved my confidence and prepared me for professional IT work.',
      avatar: 'assets/images/testimonial/client-02.png',
      name: 'Nisha Reddy',
      role: 'Python Trainee',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'Working on live projects at ICTEL helped me build practical skills that I could showcase in interviews.',
      avatar: 'assets/images/testimonial/client-03.png',
      name: 'Rahul Das',
      role: 'Data Science Student',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'The trainers focused on hands-on learning, and that made the transition from classroom concepts to real tasks much easier.',
      avatar: 'assets/images/testimonial/client-04.png',
      name: 'Meera Joseph',
      role: 'Cloud Computing Learner',
    },
    {
      icon: 'assets/images/icons/hubs.png',
      quote:
        'ICTEL supported my career growth with project-based training and guidance that matched current industry needs.',
      avatar: 'assets/images/testimonial/client-05.png',
      name: 'Karthik Iyer',
      role: 'Networking Student',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'The certification-oriented training gave me both technical knowledge and the confidence to apply for better roles.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Sneha Pillai',
      role: 'AI Program Student',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'I gained real exposure through practical assignments and internship preparation sessions at ICTEL.',
      avatar: 'assets/images/testimonial/client-07.png',
      name: 'Vikram Nair',
      role: 'Ethical Hacking Student',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'The learning model combined theory, practice, and live project work in a way that felt relevant to the job market.',
      avatar: 'assets/images/testimonial/client-08.png',
      name: 'Ananya Suresh',
      role: 'Digital Marketing Trainee',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'My internship experience through ICTEL helped me understand workplace expectations and improve my technical skills.',
      avatar: 'assets/images/testimonial/client-06.png',
      name: 'Aditya Kumar',
      role: 'Software Development Student',
    },
  ];

  readonly upcomingEvents: EventItem[] = [
    {
      image: 'assets/images/event/grid-type-02.jpg',
      dayMonth: '11 Mar',
      year: '2024',
      location: 'Vancouver',
      time: '8:00 am - 5:00 pm',
      title: 'Painting Art Contest 2020 for histudy Clud',
    },
    {
      image: 'assets/images/event/grid-type-04.jpg',
      dayMonth: '11 Jan',
      year: '2024',
      location: 'IAC Building',
      time: '8:00 am - 5:00 pm',
      title: 'Elegant Light Box Paper Cut Dioramas in UK',
    },
    {
      image: 'assets/images/event/grid-type-05.jpg',
      dayMonth: '11 Mar',
      year: '2024',
      location: 'Vancouver',
      time: '8:00 am - 5:00 pm',
      title: "Most Effective Ways for Education's Problem",
    },
    {
      image: 'assets/images/event/grid-type-01.jpg',
      dayMonth: '11 Jan',
      year: '2024',
      location: 'IAC Building',
      time: '8:00 am - 5:00 pm',
      title: 'International Education Fair 2024',
    },
  ];

  readonly teachers: Teacher[] = [
    {
      id: 'team-tab1',
      image: 'assets/images/team/team-01.jpg',
      name: 'Mames Mary',
      designation: 'English Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'Histudy The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
    {
      id: 'team-tab2',
      image: 'assets/images/team/team-02.jpg',
      name: 'Robert Song',
      designation: 'Math Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'Education The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
    {
      id: 'team-tab3',
      image: 'assets/images/team/team-03.jpg',
      name: 'William Susan',
      designation: 'React Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'React The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
    {
      id: 'team-tab4',
      image: 'assets/images/team/team-04.jpg',
      name: 'Soseph Sara',
      designation: 'Web Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'Histudy The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
    {
      id: 'team-tab5',
      image: 'assets/images/team/team-05.jpg',
      name: 'Thomas Dal',
      designation: 'Graphic Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'Histudy The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
    {
      id: 'team-tab6',
      image: 'assets/images/team/team-06.jpg',
      name: 'Christopher Lisa',
      designation: 'English Teacher',
      location: 'CO Miego, AD,USA',
      description:
        'Histudy The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested.',
      phone: '+1-202-555-0174',
      email: 'example@gmail.com',
    },
  ];

  readonly featuredBlog: BlogItem = {
    image: 'assets/images/blog/blog-card-01.jpg',
    title: 'React',
    description: 'It is a long established fact that a reader.',
    buttonLabel: 'Learn More',
  };

  readonly blogList: BlogItem[] = [
    {
      image: 'assets/images/blog/blog-card-02.jpg',
      title: 'Why Is Education So Famous?',
      buttonLabel: 'Read Article',
    },
    {
      image: 'assets/images/blog/blog-card-03.jpg',
      title: 'Difficult Things About Education.',
      buttonLabel: 'Read Article',
    },
    {
      image: 'assets/images/blog/blog-card-04.jpg',
      title: 'Education Is So Famous, But Why?',
      buttonLabel: 'Read Article',
    },
  ];

  readonly newsletterCounters: NewsletterCounter[] = [
    {
      value: '500',
      title: 'Successfully Trained',
      subtitle: 'Learners & counting',
    },
    {
      value: '100',
      title: 'Certification Students',
      subtitle: 'Online Course',
      extraClasses: 'mt_mobile--30',
    },
  ];

  readonly activeTeacherId = signal(this.teachers[0].id);
  readonly activeTeacher = computed(
    () =>
      this.teachers.find((teacher) => teacher.id === this.activeTeacherId()) ?? this.teachers[0],
  );

  handleNewsletterSubmit(event: Event): void {
    event.preventDefault();
  }

  selectHeroCourse(index: number): void {
    this.activeHeroIndex.set(index);
  }

  selectTeacher(teacherId: string): void {
    this.activeTeacherId.set(teacherId);
  }
}
