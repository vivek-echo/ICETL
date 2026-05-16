import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface CoursePageCourse {
  id: string;
  title: string;
  category: string;
  image: string;
  lessons: number;
  students: number;
  reviews: number;
  price: number;
  originalPrice: number;
  author: string;
  authorImage: string;
  level: string;
  duration: string;
  badge: string;
  description: string;
  route: string;
}

interface CategoryMeta {
  title: string;
  description: string;
  iconClass: string;
  accentLabel: string;
}

interface CategoryCard extends CategoryMeta {
  courseCount: number;
}

interface BannerStat {
  value: string;
  label: string;
}

interface CourseFilterModel {
  search: string;
  category: string;
  duration: string;
}

@Component({
  selector: 'app-courses',
  imports: [RouterLink, FormsModule],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class CoursesComponent {
  readonly homeRoute = '/';
  readonly instructorRoute = '/become-instructor';
  readonly loginRoute = '/login';

  readonly allCategoryLabel = 'All Categories';
  readonly allDurationLabel = 'All Durations';

  readonly bannerStats: BannerStat[] = [
    { value: '40+', label: 'Career-focused programs' },
    { value: '12+', label: 'Industry domains' },
    { value: '1000+', label: 'Learners trained' },
  ];

  readonly categoryMeta: CategoryMeta[] = [
    {
      title: 'Programming',
      description:
        'Build strong coding fundamentals with practical training in modern programming technologies.',
      iconClass: 'fa-solid fa-laptop-code',
      accentLabel: 'Core Skills',
    },
    {
      title: 'Web Development',
      description:
        'Master frontend and backend development for modern websites and web applications.',
      iconClass: 'fa-solid fa-code',
      accentLabel: 'Career Ready',
    },
    {
      title: 'Mobile Development',
      description:
        'Create Android mobile applications with modern UI and API integration techniques.',
      iconClass: 'fa-solid fa-mobile-screen-button',
      accentLabel: 'App Development',
    },
    {
      title: 'AI & Data Science',
      description:
        'Learn artificial intelligence, machine learning, analytics, and data-driven technologies.',
      iconClass: 'fa-solid fa-brain',
      accentLabel: 'Future Tech',
    },
    {
      title: 'Cyber Security',
      description:
        'Understand ethical hacking, cyber protection, and modern information security practices.',
      iconClass: 'fa-solid fa-shield-halved',
      accentLabel: 'High Growth',
    },
    {
      title: 'Cloud Computing',
      description:
        'Gain practical knowledge of cloud infrastructure, deployment, and DevOps practices.',
      iconClass: 'fa-solid fa-cloud',
      accentLabel: 'Industry Demand',
    },
    {
      title: 'Networking',
      description:
        'Develop networking and infrastructure management skills for enterprise environments.',
      iconClass: 'fa-solid fa-network-wired',
      accentLabel: 'Infrastructure',
    },
    {
      title: 'Embedded Systems',
      description:
        'Learn IoT, robotics, embedded programming, and smart device integration technologies.',
      iconClass: 'fa-solid fa-microchip',
      accentLabel: 'Emerging Tech',
    },
    {
      title: 'CAD Training',
      description:
        'Professional CAD training programs for civil and mechanical design applications.',
      iconClass: 'fa-solid fa-drafting-compass',
      accentLabel: 'Diploma Courses',
    },
    {
      title: 'Digital Marketing',
      description:
        'Learn SEO, social media marketing, online campaigns, and digital branding strategies.',
      iconClass: 'fa-solid fa-bullhorn',
      accentLabel: 'Business Skills',
    },
    {
      title: 'Software Testing',
      description:
        'Learn manual testing, automation basics, and software quality assurance techniques.',
      iconClass: 'fa-solid fa-vial-circle-check',
      accentLabel: 'QA Skills',
    },
  ];
  readonly courses: CoursePageCourse[] = [
    {
      id: 'full-stack-development',
      title: 'Full Stack Development',
      category: 'Web Development',
      image: 'assets/images/course/course-03.png',
      lessons: 18,
      students: 240,
      reviews: 46,
      price: 69,
      originalPrice: 110,
      author: 'Akhil Mathew',
      authorImage: 'assets/images/client/avatar-02.png',
      level: 'Intermediate',
      duration: '8 Weeks',
      badge: '-37%',
      description:
        'Build modern frontend and backend applications with real-world project training.',
      route: '/courses/full-stack-development',
    },
    {
      id: 'python-programming',
      title: 'Python Programming',
      category: 'Programming',
      image: 'assets/images/course/course-01.png',
      lessons: 16,
      students: 278,
      reviews: 41,
      price: 64,
      originalPrice: 102,
      author: 'Nithin George',
      authorImage: 'assets/images/client/avatar-01.png',
      level: 'Beginner',
      duration: '6 Weeks',
      badge: '-37%',
      description:
        'Learn Python fundamentals, automation, problem solving, and practical application development.',
      route: '/courses/python-programming',
    },
    {
      id: 'java-programming',
      title: 'Java Programming',
      category: 'Programming',
      image: 'assets/images/course/course-02.png',
      lessons: 17,
      students: 220,
      reviews: 36,
      price: 66,
      originalPrice: 105,
      author: 'Rahul Menon',
      authorImage: 'assets/images/client/avatar-03.png',
      level: 'Intermediate',
      duration: '7 Weeks',
      badge: '-36%',
      description:
        'Master object-oriented programming concepts and enterprise Java application development.',
      route: '/courses/java-programming',
    },
    {
      id: 'php-development',
      title: 'PHP Development',
      category: 'Web Development',
      image: 'assets/images/course/course-04.png',
      lessons: 15,
      students: 194,
      reviews: 29,
      price: 61,
      originalPrice: 98,
      author: 'Stephy Jose',
      authorImage: 'assets/images/client/avatar-04.png',
      level: 'Beginner',
      duration: '6 Weeks',
      badge: '-38%',
      description: 'Build dynamic websites and backend systems using PHP and MySQL technologies.',
      route: '/courses/php-development',
    },
    {
      id: 'dotnet-development',
      title: '.NET Development',
      category: 'Programming',
      image: 'assets/images/course/course-05.png',
      lessons: 18,
      students: 205,
      reviews: 33,
      price: 72,
      originalPrice: 114,
      author: 'Aswin Ravi',
      authorImage: 'assets/images/client/avatar-05.png',
      level: 'Intermediate',
      duration: '8 Weeks',
      badge: '-37%',
      description:
        'Develop scalable desktop and web applications using Microsoft .NET technologies.',
      route: '/courses/dotnet-development',
    },
    {
      id: 'android-development',
      title: 'Android Development',
      category: 'Mobile Development',
      image: 'assets/images/course/course-06.png',
      lessons: 16,
      students: 232,
      reviews: 38,
      price: 68,
      originalPrice: 109,
      author: 'Megha Raj',
      authorImage: 'assets/images/client/avatar-02.png',
      level: 'Intermediate',
      duration: '7 Weeks',
      badge: '-37%',
      description:
        'Create Android mobile applications with practical UI and API integration projects.',
      route: '/courses/android-development',
    },
    {
      id: 'artificial-intelligence',
      title: 'Artificial Intelligence',
      category: 'AI & Data Science',
      image: 'assets/images/course/course-online-01.png',
      lessons: 20,
      students: 198,
      reviews: 34,
      price: 79,
      originalPrice: 122,
      author: 'Megha Raj',
      authorImage: 'assets/images/client/avatar-03.png',
      level: 'Intermediate',
      duration: '9 Weeks',
      badge: '-35%',
      description: 'Understand intelligent systems, AI concepts, and practical industry use cases.',
      route: '/courses/artificial-intelligence',
    },
    {
      id: 'machine-learning',
      title: 'Machine Learning',
      category: 'AI & Data Science',
      image: 'assets/images/course/course-online-02.png',
      lessons: 19,
      students: 186,
      reviews: 31,
      price: 82,
      originalPrice: 126,
      author: 'Akhil Mathew',
      authorImage: 'assets/images/client/avatar-04.png',
      level: 'Advanced',
      duration: '9 Weeks',
      badge: '-35%',
      description:
        'Learn predictive models, algorithms, and machine learning implementation techniques.',
      route: '/courses/machine-learning',
    },
    {
      id: 'data-science',
      title: 'Data Science',
      category: 'AI & Data Science',
      image: 'assets/images/course/classic-lms-01.png',
      lessons: 18,
      students: 232,
      reviews: 37,
      price: 76,
      originalPrice: 119,
      author: 'Rahul Menon',
      authorImage: 'assets/images/client/avatar-02.png',
      level: 'Intermediate',
      duration: '8 Weeks',
      badge: '-36%',
      description:
        'Work with analytics, visualization, statistics, and business-focused data interpretation.',
      route: '/courses/data-science',
    },
    {
      id: 'cloud-computing',
      title: 'Cloud Computing',
      category: 'Cloud Computing',
      image: 'assets/images/course/course-07.png',
      lessons: 17,
      students: 226,
      reviews: 39,
      price: 74,
      originalPrice: 118,
      author: 'Aswin Ravi',
      authorImage: 'assets/images/client/avatar-04.png',
      level: 'Intermediate',
      duration: '7 Weeks',
      badge: '-37%',
      description: 'Learn cloud deployment, infrastructure management, and DevOps fundamentals.',
      route: '/courses/cloud-computing',
    },
    {
      id: 'ethical-hacking',
      title: 'Ethical Hacking',
      category: 'Cyber Security',
      image: 'assets/images/course/course-08.png',
      lessons: 15,
      students: 182,
      reviews: 28,
      price: 72,
      originalPrice: 114,
      author: 'Riya Nair',
      authorImage: 'assets/images/client/avatar-05.png',
      level: 'Beginner',
      duration: '6 Weeks',
      badge: '-36%',
      description:
        'Explore penetration testing, vulnerability assessment, and ethical hacking practices.',
      route: '/courses/ethical-hacking',
    },
    {
      id: 'information-security',
      title: 'Information Security',
      category: 'Cyber Security',
      image: 'assets/images/course/course-09.png',
      lessons: 14,
      students: 168,
      reviews: 25,
      price: 70,
      originalPrice: 108,
      author: 'Nithin George',
      authorImage: 'assets/images/client/avatar-01.png',
      level: 'Intermediate',
      duration: '6 Weeks',
      badge: '-35%',
      description:
        'Understand cyber defense, data protection, and modern security management concepts.',
      route: '/courses/information-security',
    },
    {
      id: 'software-testing',
      title: 'Software Testing',
      category: 'Software Testing',
      image: 'assets/images/course/course-10.png',
      lessons: 13,
      students: 176,
      reviews: 27,
      price: 59,
      originalPrice: 94,
      author: 'Stephy Jose',
      authorImage: 'assets/images/client/avatar-03.png',
      level: 'Beginner',
      duration: '5 Weeks',
      badge: '-37%',
      description:
        'Learn manual testing, automation basics, and software quality assurance practices.',
      route: '/courses/software-testing',
    },
    {
      id: 'digital-marketing',
      title: 'Digital Marketing',
      category: 'Digital Marketing',
      image: 'assets/images/course/classic-lms-02.png',
      lessons: 13,
      students: 254,
      reviews: 36,
      price: 58,
      originalPrice: 92,
      author: 'Stephy Jose',
      authorImage: 'assets/images/client/avatar-03.png',
      level: 'Beginner',
      duration: '5 Weeks',
      badge: '-37%',
      description:
        'Build skills in SEO, social media campaigns, branding, and digital marketing strategies.',
      route: '/courses/digital-marketing',
    },
    {
      id: 'networking',
      title: 'Networking',
      category: 'Networking',
      image: 'assets/images/course/course-online-03.png',
      lessons: 14,
      students: 207,
      reviews: 31,
      price: 61,
      originalPrice: 98,
      author: 'Rahul Menon',
      authorImage: 'assets/images/client/avatar-02.png',
      level: 'Intermediate',
      duration: '5 Weeks',
      badge: '-38%',
      description:
        'Understand routing, switching, infrastructure setup, and practical network management.',
      route: '/courses/networking',
    },
    {
      id: 'iot',
      title: 'Internet of Things (IoT)',
      category: 'Embedded Systems',
      image: 'assets/images/course/course-11.png',
      lessons: 16,
      students: 158,
      reviews: 24,
      price: 75,
      originalPrice: 118,
      author: 'Aswin Ravi',
      authorImage: 'assets/images/client/avatar-04.png',
      level: 'Intermediate',
      duration: '7 Weeks',
      badge: '-36%',
      description:
        'Learn IoT architecture, smart device integration, and sensor-based applications.',
      route: '/courses/iot',
    },
    {
      id: 'embedded-systems',
      title: 'Embedded Systems & Robotics',
      category: 'Embedded Systems',
      image: 'assets/images/course/course-12.png',
      lessons: 18,
      students: 142,
      reviews: 22,
      price: 84,
      originalPrice: 130,
      author: 'Akhil Mathew',
      authorImage: 'assets/images/client/avatar-02.png',
      level: 'Advanced',
      duration: '9 Weeks',
      badge: '-35%',
      description:
        'Develop robotics and embedded solutions with hardware and microcontroller programming.',
      route: '/courses/embedded-systems',
    },
    {
      id: 'civil-cad',
      title: 'Diploma in Civil CAD',
      category: 'CAD Training',
      image: 'assets/images/course/course-13.png',
      lessons: 20,
      students: 188,
      reviews: 30,
      price: 88,
      originalPrice: 135,
      author: 'Megha Raj',
      authorImage: 'assets/images/client/avatar-03.png',
      level: 'Intermediate',
      duration: '10 Weeks',
      badge: '-35%',
      description:
        'Learn drafting, AutoCAD, and civil engineering design workflows for infrastructure projects.',
      route: '/courses/civil-cad',
    },
    {
      id: 'mechanical-cad',
      title: 'Diploma in Mechanical CAD',
      category: 'CAD Training',
      image: 'assets/images/course/course-14.png',
      lessons: 19,
      students: 176,
      reviews: 28,
      price: 86,
      originalPrice: 132,
      author: 'Riya Nair',
      authorImage: 'assets/images/client/avatar-05.png',
      level: 'Intermediate',
      duration: '10 Weeks',
      badge: '-35%',
      description:
        'Master CAD tools and mechanical design concepts used in manufacturing industries.',
      route: '/courses/mechanical-cad',
    },
  ];
  readonly defaultFilters: CourseFilterModel = {
    search: '',
    category: this.allCategoryLabel,
    duration: this.allDurationLabel,
  };

  readonly filters = signal<CourseFilterModel>({ ...this.defaultFilters });

  readonly durations = computed(() => [
    this.allDurationLabel,
    ...new Set(this.courses.map((course) => course.duration)),
  ]);

  readonly categories = computed(() => [
    this.allCategoryLabel,
    ...this.categoryMeta.map((category) => category.title),
  ]);

  readonly categoryCards = computed<CategoryCard[]>(() =>
    this.categoryMeta.map((category) => ({
      ...category,
      courseCount: this.courses.filter((course) => course.category === category.title).length,
    })),
  );

  readonly filteredCourses = computed(() => {
    const filters = this.filters();
    const query = filters.search.trim().toLowerCase();
    const category = filters.category;
    const duration = filters.duration;

    let filtered = this.courses.filter((course) => {
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query);
      const matchesCategory = category === this.allCategoryLabel || course.category === category;
      const matchesDuration = duration === this.allDurationLabel || course.duration === duration;

      return matchesQuery && matchesCategory && matchesDuration;
    });

    filtered = [...filtered];
    filtered.sort((first, second) => second.reviews - first.reviews);

    return filtered;
  });

  readonly resultsSummary = computed(() => {
    const count = this.filteredCourses().length;
    const category =
      this.filters().category === this.allCategoryLabel
        ? 'all course categories'
        : this.filters().category;

    return `${count} course${count === 1 ? '' : 's'} available in ${category}.`;
  });

  readonly hasActiveFilters = computed(
    () =>
      this.filters().search.trim().length > 0 ||
      this.filters().category !== this.allCategoryLabel ||
      this.filters().duration !== this.allDurationLabel,
  );

  updateSearchQuery(value: string): void {
    this.filters.update((filters) => ({
      ...filters,
      search: value,
    }));
  }

  updateCategory(category: string): void {
    this.filters.update((filters) => ({
      ...filters,
      category,
    }));
  }

  updateDuration(duration: string): void {
    this.filters.update((filters) => ({
      ...filters,
      duration,
    }));
  }

  clearFilters(): void {
    this.filters.set({ ...this.defaultFilters });
  }
}
