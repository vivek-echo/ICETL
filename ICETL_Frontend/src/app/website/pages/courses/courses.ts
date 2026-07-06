import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import {
  Course,
  PublicCourseApiItem,
  PublicCourseSummary,
} from '../../../application/courses/services/course';

interface CoursePageCourse {
  id: string;
  title: string;
  categoryId?: number | null;
  categoryKey?: string;
  category: string;
  image: string;
  lessons: number;
  students: number;
  reviews: number;
  price: number;
  originalPrice: number | null;
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
  id: number | string;
  categoryId: number | null;
  key: string;
  iconUrl?: string | null;
  courseCount: number;
}

interface BannerStat {
  value: string;
  label: string;
  iconClass: string;
}

interface CourseFilterModel {
  search: string;
  categoryKey: string;
  duration: string;
}

interface CourseCategoryResponseItem {
  id: number;
  categoryName: string;
  iconUrl?: string | null;
  categoryIcon?: string | null;
  courseCount?: number | null;
}

interface CourseCategoryResponse {
  status: boolean;
  data: CourseCategoryResponseItem[];
}

@Component({
  selector: 'app-courses',
  imports: [RouterLink, FormsModule],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class CoursesComponent {
  readonly homeRoute = '/';
  readonly contactRoute = '/contact';
  readonly instructorRoute = '/become-instructor';
  readonly loginRoute = '/login';
  readonly placeholderCourseImage = 'assets/images/course/course-01.png';
  readonly placeholderAuthorImage = 'assets/images/client/avatar-02.png';
  showFilters = false;
  private readonly document = inject(DOCUMENT);
  private readonly courseService = inject(Course);

  readonly allCategoryLabel = 'All Categories';
  readonly allCategoryKey = 'all';
  readonly allDurationLabel = 'All Durations';
  readonly loadingCourses = signal(true);
  readonly courseCategories = signal<CourseCategoryResponseItem[]>([]);
  readonly courseSummary = signal<PublicCourseSummary>({
    totalCourses: 0,
    totalCategories: 0,
    totalStudents: 0,
  });

  readonly bannerStats = computed<BannerStat[]>(() => {
    const courses = this.courses();
    const summary = this.courseSummary();
    const totalStudents =
      summary.totalStudents || courses.reduce((total, course) => total + course.students, 0);
    const totalCourses = summary.totalCourses || courses.length;
    const totalCategories = summary.totalCategories || this.categoryCards().length;

    return [
      { value: this.formatCompactCount(totalStudents), label: 'Learners', iconClass: 'fa-solid fa-users' },
      {
        value: this.formatCompactCount(totalCourses),
        label: 'Courses',
        iconClass: 'fa-solid fa-graduation-cap',
      },
      {
        value: this.formatCompactCount(totalCategories),
        label: 'Categories',
        iconClass: 'fa-solid fa-layer-group',
      },
    ];
  });

  constructor() {
    afterNextRender(() => {
      void this.loadDynamicCourseData();
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

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
  private readonly fallbackCourses: CoursePageCourse[] = [
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
  readonly courses = signal<CoursePageCourse[]>(this.fallbackCourses);

  readonly defaultFilters: CourseFilterModel = {
    search: '',
    categoryKey: this.allCategoryKey,
    duration: this.allDurationLabel,
  };

  readonly filters = signal<CourseFilterModel>({ ...this.defaultFilters });

  readonly durations = computed(() => [
    this.allDurationLabel,
    ...new Set(this.courses().map((course) => course.duration).filter(Boolean)),
  ]);

  readonly categoryOptions = computed(() => [
    {
      key: this.allCategoryKey,
      title: this.allCategoryLabel,
    },
    ...this.categoryCards().map((category) => ({
      key: category.key,
      title: category.title,
    })),
  ]);

  readonly categoryCards = computed<CategoryCard[]>(() => {
    const courses = this.courses();
    const apiCategories = this.courseCategories();

    if (apiCategories.length) {
      return apiCategories.map((category) => {
        const meta = this.resolveCategoryMeta(category.categoryName, category.categoryIcon);
        const key = this.getCategoryKey(category.id, category.categoryName);

        return {
          ...meta,
          id: category.id,
          categoryId: category.id,
          key,
          iconUrl: category.iconUrl,
          title: category.categoryName,
          courseCount:
            category.courseCount ??
            courses.filter((course) => this.resolveCourseCategoryKey(course) === key).length,
        };
      });
    }

    return [...new Set(courses.map((course) => course.category))]
      .filter(Boolean)
      .map((category) => {
        const meta = this.resolveCategoryMeta(category);
        const key = this.getCategoryKey(null, category);

        return {
          ...meta,
          id: key,
          categoryId: null,
          key,
          title: category,
          courseCount: courses.filter((course) => this.resolveCourseCategoryKey(course) === key).length,
        };
      });
  });

  readonly filteredCourses = computed(() => {
    const filters = this.filters();
    const query = filters.search.trim().toLowerCase();
    const categoryKey = filters.categoryKey;
    const duration = filters.duration;

    let filtered = this.courses().filter((course) => {
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query);
      const matchesCategory =
        categoryKey === this.allCategoryKey || this.resolveCourseCategoryKey(course) === categoryKey;
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
      this.filters().categoryKey === this.allCategoryKey
        ? 'all course categories'
        : this.selectedCategoryTitle();

    return `${count} course${count === 1 ? '' : 's'} available in ${category}.`;
  });

  readonly hasActiveFilters = computed(
    () =>
      this.filters().search.trim().length > 0 ||
      this.filters().categoryKey !== this.allCategoryKey ||
      this.filters().duration !== this.allDurationLabel,
  );

  readonly selectedCategoryTitle = computed(() => {
    const selectedKey = this.filters().categoryKey;

    return (
      this.categoryOptions().find((category) => category.key === selectedKey)?.title ||
      this.allCategoryLabel
    );
  });

  async loadDynamicCourseData(): Promise<void> {
    this.loadingCourses.set(true);

    try {
      const [categoryResponse, courseResponse] = await Promise.all([
        lastValueFrom(
          this.courseService
            .getCourseCategoriesPreLogin({
              search: '',
              status: 1,
            })
            .pipe(timeout(15000)),
        ) as Promise<CourseCategoryResponse>,
        lastValueFrom(
          this.courseService
            .getPublicCourses({
              page: 1,
              perPage: 'all',
              sortBy: 'newest',
            })
            .pipe(timeout(15000)),
        ),
      ]);

      this.courseCategories.set(categoryResponse.status ? categoryResponse.data ?? [] : []);

      if (courseResponse.status) {
        this.courses.set((courseResponse.data ?? []).map((course) => this.toCoursePageCourse(course)));
        this.courseSummary.set(courseResponse.summary);
      } else {
        this.courses.set([]);
      }
    } catch (error) {
      console.error(error);
      this.courses.set(this.fallbackCourses);
    } finally {
      this.loadingCourses.set(false);
    }
  }

  formatAmount(amount: number | string | null): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  }

  onCourseImageError(course: CoursePageCourse): void {
    course.image = this.placeholderCourseImage;
  }

  private toCoursePageCourse(course: PublicCourseApiItem): CoursePageCourse {
    const price = this.toNumber(course.price);
    const originalPrice = this.getOriginalPrice(course.oldPrice, price);
    const discount = this.getDiscountPercent(price, originalPrice);

    return {
      id: `${course.id}`,
      title: course.title,
      categoryId: course.categoryId,
      categoryKey: this.getCategoryKey(course.categoryId, course.categoryName),
      category: course.categoryName || 'Course',
      image: course.thumbnailUrl || this.placeholderCourseImage,
      lessons: this.getLessonsCount(course),
      students: this.getStudentsCount(course),
      reviews: this.getReviewCount(course),
      price,
      originalPrice,
      author: course.instructorName || 'ICETL Instructor',
      authorImage: this.placeholderAuthorImage,
      level: this.getLevelLabel(course),
      duration: this.getDurationLabel(course),
      badge: discount > 0 ? `-${discount}%` : 'Active',
      description:
        course.description || 'Build practical skills with a focused, instructor-led program.',
      route: this.loginRoute,
    };
  }

  private resolveCategoryMeta(title: string, iconClass?: string | null): CategoryMeta {
    const matchedMeta = this.categoryMeta.find(
      (category) => category.title.toLowerCase() === title.toLowerCase(),
    );

    return {
      title,
      description:
        matchedMeta?.description ||
        `Explore practical ${title} courses built for current technology careers.`,
      iconClass: iconClass || matchedMeta?.iconClass || 'fa-solid fa-graduation-cap',
      accentLabel: matchedMeta?.accentLabel || 'Career Skills',
    };
  }

  private resolveCourseCategoryKey(course: CoursePageCourse): string {
    return course.categoryKey || this.getCategoryKey(course.categoryId, course.category);
  }

  private getCategoryKey(categoryId: number | null | undefined, categoryName: string): string {
    if (categoryId) {
      return `id:${categoryId}`;
    }

    return `name:${categoryName.trim().toLowerCase()}`;
  }

  private getDurationLabel(course: PublicCourseApiItem): string {
    if (!course.duration) {
      return 'Flexible';
    }

    const unit = Number(course.durationUnit) === 2 ? 'Month' : 'Week';
    const duration = Number(course.duration);
    const suffix = duration === 1 ? unit : `${unit}s`;

    return `${course.duration} ${suffix}`;
  }

  private getLevelLabel(course: PublicCourseApiItem): string {
    const duration = Number(course.duration) || 0;

    if (duration >= 9) {
      return 'Advanced';
    }

    if (duration >= 6) {
      return 'Intermediate';
    }

    return 'Beginner';
  }

  private getLessonsCount(course: PublicCourseApiItem): number {
    return Number(course.lessonsCount) || Math.max(course.courseHighlights?.length || 0, 1);
  }

  private getStudentsCount(course: PublicCourseApiItem): number {
    return Number(course.studentsCount) || 120 + this.seedFromCourseId(course.id) * 9;
  }

  private getReviewCount(course: PublicCourseApiItem): number {
    return Math.max(12, Math.round(this.getStudentsCount(course) / 7));
  }

  private getOriginalPrice(value: number | string | null, price: number): number | null {
    const originalPrice = this.toNumber(value);

    return originalPrice > price ? originalPrice : null;
  }

  private getDiscountPercent(price: number, originalPrice: number | null): number {
    if (!originalPrice || originalPrice <= price) {
      return 0;
    }

    return Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  private toNumber(value: number | string | null): number {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private seedFromCourseId(courseId: number): number {
    return ((courseId || 1) * 17) % 97;
  }

  private formatCompactCount(value: number): string {
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k+`;
    }

    return `${value}+`;
  }

  updateSearchQuery(value: string): void {
    this.filters.update((filters) => ({
      ...filters,
      search: value,
    }));
  }

  updateCategory(categoryKey: string): void {
    this.filters.update((filters) => ({
      ...filters,
      categoryKey,
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

  scrollToCourses(): void {
    const courseListSection = this.document.getElementById('course-list-section');
    courseListSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
