import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  title: string;
  image: string;
  courseCount: number;
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

  readonly heroCourses: BannerCourse[] = [
    {
      title: 'React',
      image: 'assets/images/course/course-01.jpg',
      badge: '-40%',
      lessons: 12,
      students: 50,
      reviews: 15,
      price: 70,
      originalPrice: 120,
      description: 'It is a long established fact that a reader will be distracted.',
    },
    {
      title: 'UI/UX Design',
      image: 'assets/images/course/classic-lms-01.jpg',
      badge: '-35%',
      lessons: 18,
      students: 42,
      reviews: 12,
      price: 64,
      originalPrice: 99,
      description: 'Learn modern interface systems, wireframes, and prototyping workflows.',
    },
    {
      title: 'Python Bootcamp',
      image: 'assets/images/course/course-online-02.jpg',
      badge: '-50%',
      lessons: 24,
      students: 68,
      reviews: 21,
      price: 80,
      originalPrice: 140,
      description: 'Build real-world programming confidence with projects, APIs, and tooling.',
    },
  ];

  readonly activeHeroIndex = signal(0);
  readonly activeHeroCourse = computed(
    () => this.heroCourses[this.activeHeroIndex()] ?? this.heroCourses[0],
  );

  readonly categoryBoxes: CategoryBox[] = [
    { title: 'Web Design', image: 'assets/images/category/web-design.png', courseCount: 25 },
    { title: 'Graphic Design', image: 'assets/images/category/design.png', courseCount: 30 },
    { title: 'Personal Development', image: 'assets/images/category/personal.png', courseCount: 20 },
    { title: 'IT and Software', image: 'assets/images/category/server.png', courseCount: 15 },
    { title: 'Sales Marketing', image: 'assets/images/category/pantone.png', courseCount: 15 },
    { title: 'Art & Humanities', image: 'assets/images/category/paint-palette.png', courseCount: 15 },
    { title: 'Mobile Application', image: 'assets/images/category/smartphone.png', courseCount: 15 },
    { title: 'Finance & Accounting', image: 'assets/images/category/infographic.png', courseCount: 15 },
  ];

  readonly popularCourses: PopularCourse[] = [
    {
      title: 'React Front To Back',
      image: 'assets/images/course/course-01.jpg',
      badge: '-50%',
      lessons: 20,
      students: 40,
      reviews: 15,
      description: 'React Js long fact that a reader will be distracted by the readable.',
      author: 'Patrick',
      authorImage: 'assets/images/client/avater-01.png',
      category: 'Languages',
      price: 60,
      originalPrice: 120,
      actionLabel: 'Learn More',
      actionIcon: 'feather-arrow-right',
    },
    {
      title: 'PHP Beginner + Advanced',
      image: 'assets/images/course/course-02.jpg',
      badge: '-40%',
      lessons: 12,
      students: 50,
      reviews: 15,
      description: 'It is a long established fact that a reader will be distracted by the readable.',
      author: 'Angela',
      authorImage: 'assets/images/client/avatar-02.png',
      category: 'Development',
      price: 60,
      originalPrice: 120,
      actionLabel: 'Add To Cart',
      actionIcon: 'feather-shopping-cart',
    },
    {
      title: 'Angular Zero to Mastery',
      image: 'assets/images/course/course-03.jpg',
      badge: '-40%',
      lessons: 8,
      students: 30,
      reviews: 5,
      description: 'Angular Js long fact that a reader will be distracted by the readable.',
      author: 'Slaughter',
      authorImage: 'assets/images/client/avatar-03.png',
      category: 'Languages',
      price: 80,
      originalPrice: 100,
      actionLabel: 'Learn More',
      actionIcon: 'feather-arrow-right',
    },
  ];

  readonly aboutFeatures: AboutFeature[] = [
    {
      title: 'Flexible Classes',
      description:
        'It is a long established fact that a reader will be distracted by this on readable content of when looking at its layout.',
      iconClass: 'feather-heart',
      backgroundClass: 'bg-pink-opacity',
    },
    {
      title: 'Learn From Anywhere',
      description:
        'Sed distinctio repudiandae eos recusandae laborum eaque non eius iure suscipit laborum eaque non eius iure suscipit.',
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
      value: '1000',
      label: 'Certified Students',
      extraClasses: 'mt_md--60 mt_sm--60',
    },
    {
      image: 'assets/images/icons/counter-04.png',
      value: '100',
      label: 'Registered Enrolls',
      extraClasses: 'mt--60 mt_md--30 mt_sm--30 mt_mobile--60',
    },
  ];

  readonly testimonialRowOne: TestimonialItem[] = [
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'After the launch, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Martha Maldonado',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/google.png',
      quote:
        'Histudy education, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-02.png',
      name: 'Michael D.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'Our educational, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-03.png',
      name: 'Valerie J.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'People says about, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-04.png',
      name: 'Hannah R.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'Like this histudy, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-05.png',
      name: 'Pearl B. Hill',
      role: 'Marketing',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'Educational template, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Mandy F. Wood',
      role: 'SR Designer',
    },
    {
      icon: 'assets/images/icons/hubs.png',
      quote:
        'Online leaning, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-07.png',
      name: 'Mildred W. Diaz',
      role: 'Executive',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'Remote learning, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-08.png',
      name: 'Christopher',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'University managemnet, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-06.png',
      name: 'Fatima',
      role: 'Child',
    },
  ];

  readonly testimonialRowTwo: TestimonialItem[] = [
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'After the launch, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Martha Maldonado',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/google.png',
      quote:
        'Histudy education, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-02.png',
      name: 'Michael D.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'Our educational, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-03.png',
      name: 'Valerie J.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'People says about, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-04.png',
      name: 'Hannah R.',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/hubs.png',
      quote:
        'Like this histudy, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-05.png',
      name: 'Pearl B. Hill',
      role: 'Marketing',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'Educational template, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-01.png',
      name: 'Mandy F. Wood',
      role: 'SR Designer',
    },
    {
      icon: 'assets/images/icons/bing.png',
      quote:
        'Online leaning, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-07.png',
      name: 'Mildred W. Diaz',
      role: 'Executive',
    },
    {
      icon: 'assets/images/icons/facebook.png',
      quote:
        'Remote learning, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-08.png',
      name: 'Christopher',
      role: 'CEO',
    },
    {
      icon: 'assets/images/icons/yelp.png',
      quote:
        'University managemnet, vulputate at sapien sit amet, auctor iaculis lorem. In vel hend rerit nisi. Vestibulum eget risus velit.',
      avatar: 'assets/images/testimonial/client-06.png',
      name: 'Fatima',
      role: 'Child',
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
    () => this.teachers.find((teacher) => teacher.id === this.activeTeacherId()) ?? this.teachers[0],
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
