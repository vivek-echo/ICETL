import { afterNextRender, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { Course, PublicCourseApiItem } from '../../../application/courses/services/course';
import {
  WorkshopItem,
  WorkshopService,
} from '../../../application/workshop-seminar/services/workshop';
import { SeminarItem, SeminarService } from '../../../application/workshop-seminar/services/seminar';
import { ModalWindowControlsComponent, ModalWindowDirective } from '../../../shared/modal-window';
interface BannerCourse {
  id: string;
  title: string;
  image: string;
  badge: string;
  badgeSuffix: string;
  lessons: number;
  students: number;
  reviews: number;
  price: number;
  originalPrice: number | null;
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
  id: string;
  title: string;
  image: string;
  badge: string;
  badgeSuffix: string;
  lessons: number;
  students: number;
  reviews: number;
  description: string;
  author: string;
  authorImage: string;
  category: string;
  price: number;
  originalPrice: number | null;
  actionLabel: string;
  actionIcon: string;
  route: string;
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

interface HomeProgram {
  id: string;
  type: 'workshop' | 'seminar';
  title: string;
  topic: string;
  image: string;
  city: string;
  venue: string;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  speakerName: string;
  capacity: number;
  price: number;
  description: string;
  scheduleStatus: 'upcoming' | 'ongoing' | 'completed';
}

interface PlacementCompany {
  name: string;
  logo: string;
  sector: string;
  accent: string;
}

interface NewsletterCounter {
  value: string;
  title: string;
  subtitle: string;
  iconClass: string;
  extraClasses?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, ModalWindowDirective, ModalWindowControlsComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  readonly courseRoute = '/courses';
  readonly dashboardRoute = '/dashboard';
  readonly loginRoute = '/login';
  readonly placeholderCourseImage = 'assets/images/course/course-01.png';
  readonly placeholderAuthorImage = 'assets/images/client/avatar-02.png';
  readonly placeholderProgramImage = 'assets/images/event/grid-type-02.jpg';
  readonly homePrograms = signal<HomeProgram[]>([]);
  readonly programsLoading = signal(false);
  readonly selectedHomeProgram = signal<HomeProgram | null>(null);
  readonly programSkeletons = [1, 2, 3, 4];

  constructor(
    private courseService: Course,
    private workshopService: WorkshopService,
    private seminarService: SeminarService,
  ) {
    afterNextRender(() => {
      void this.getCourseCategories();
      void this.getHomeCourses();
      void this.getHomePrograms();
    });
  }

  private readonly defaultHeroCourses: BannerCourse[] = [
    {
      id: 'industry-focused-it-training',
      title: 'Industry-Focused IT Training',
      image: 'assets/images/course/course-011.png',
      badge: 'Internship',
      badgeSuffix: 'Support',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 70,
      originalPrice: 120,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
    {
      id: 'professional-certification-programs',
      title: 'Professional Certification Programs',
      image: 'assets/images/course/classic-lms-011.png',
      badge: 'Internship',
      badgeSuffix: 'Support',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 64,
      originalPrice: 99,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
    {
      id: 'live-projects-and-internships',
      title: 'Live Projects and Internships',
      image: 'assets/images/course/course-online-02.png',
      badge: 'Internship',
      badgeSuffix: 'Support',
      lessons: 50,
      students: 5000,
      reviews: 100,
      price: 80,
      originalPrice: 140,
      description:
        'Learn through live projects, internships, and professional certification programs at ICTEL.',
    },
  ];
  readonly heroCourses = signal<BannerCourse[]>(this.defaultHeroCourses);
  contactRoute = '/contact';
  readonly activeHeroIndex = signal(0);
  readonly activeHeroCourse = computed(() => {
    const courses = this.heroCourses();

    return courses[this.activeHeroIndex()] ?? courses[0] ?? this.defaultHeroCourses[0];
  });

  readonly categoryBoxes = signal<CategoryBox[]>([]);

  async getCourseCategories(): Promise<void> {
    const payload = {
      search: '',
      status: 1,
    };

    try {
      const response: CourseCategoryResponse = await lastValueFrom(
        this.courseService.getCourseCategoriesPreLogin(payload),
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

  readonly popularCourses = signal<PopularCourse[]>([]);

  async getHomeCourses(): Promise<void> {
    try {
      const response = await lastValueFrom(
        this.courseService
          .getPublicCourses({
            page: 1,
            perPage: 6,
            sortBy: 'popular',
          })
          .pipe(timeout(15000)),
      );

      if (!response.status) {
        this.popularCourses.set([]);
        return;
      }

      const courses = (response.data ?? []).map((course) => this.toPopularCourse(course));
      const heroCourses = (response.data ?? [])
        .slice(0, 3)
        .map((course) => this.toBannerCourse(course));

      this.popularCourses.set(courses.slice(0, 3));

      if (heroCourses.length) {
        this.heroCourses.set(heroCourses);
        this.activeHeroIndex.set(0);
      }
    } catch (error) {
      console.error(error);
      this.popularCourses.set([]);
    }
  }

  formatAmount(amount: number | string | null): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  }

  onCourseImageError(course: BannerCourse | PopularCourse): void {
    course.image = this.placeholderCourseImage;
  }

  onProgramImageError(program: HomeProgram): void {
    program.image = this.placeholderProgramImage;
  }

  async getHomePrograms(): Promise<void> {
    this.programsLoading.set(true);

    try {
      const [workshopResult, seminarResult] = await Promise.allSettled([
        lastValueFrom(
          this.workshopService
            .getPreLoginWorkshops({
              page: 1,
              sortBy: 'dateAsc',
            })
            .pipe(timeout(15000)),
        ),
        lastValueFrom(
          this.seminarService
            .getPreLoginSeminars({
              page: 1,
              sortBy: 'dateAsc',
            })
            .pipe(timeout(15000)),
        ),
      ]);

      const programs: HomeProgram[] = [];

      if (workshopResult.status === 'fulfilled' && workshopResult.value.status) {
        programs.push(...(workshopResult.value.data ?? []).map((item) => this.toHomeProgram(item)));
      }

      if (seminarResult.status === 'fulfilled' && seminarResult.value.status) {
        programs.push(...(seminarResult.value.data ?? []).map((item) => this.toHomeProgram(item)));
      }

      this.homePrograms.set(programs.sort((first, second) => this.comparePrograms(first, second)).slice(0, 4));
    } catch (error) {
      console.error(error);
      this.homePrograms.set([]);
    } finally {
      this.programsLoading.set(false);
    }
  }

  getProgramTypeLabel(program: HomeProgram): string {
    return program.type === 'workshop' ? 'Workshop' : 'Seminar';
  }

  getProgramRoute(program: HomeProgram): string {
    return program.type === 'workshop'
      ? '/application/courses/manageCourses/browseWorkshop'
      : '/application/courses/manageCourses/browseSeminars';
  }

  getProgramStatusLabel(program: HomeProgram): string {
    return program.scheduleStatus === 'ongoing' ? 'Ongoing' : 'Upcoming';
  }

  getProgramDateLabel(program: HomeProgram): string {
    const startDate = this.formatProgramDate(program.startDate);
    const endDate = program.endDate ? this.formatProgramDate(program.endDate) : '';

    return endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate;
  }

  getProgramTimeLabel(program: HomeProgram): string {
    if (!program.startTime) {
      return 'Schedule TBA';
    }

    return program.endTime ? `${program.startTime} - ${program.endTime}` : program.startTime;
  }

  openProgramDetails(program: HomeProgram): void {
    this.selectedHomeProgram.set(program);
  }

  closeProgramDetails(): void {
    this.selectedHomeProgram.set(null);
  }

  private toHomeProgram(program: WorkshopItem | SeminarItem): HomeProgram {
    return {
      id: `${program.type}-${program.id}`,
      type: program.type,
      title: program.title,
      topic: program.topic,
      image: program.bannerImageUrl || this.placeholderProgramImage,
      city: program.city,
      venue: program.venue,
      startDate: program.startDate || program.eventDate,
      endDate: program.endDate,
      startTime: program.startTime,
      endTime: program.endTime,
      speakerName: program.speakerName,
      capacity: Number(program.capacity) || 0,
      price: this.toNumber(program.price),
      description: program.description,
      scheduleStatus: program.scheduleStatus,
    };
  }

  private comparePrograms(first: HomeProgram, second: HomeProgram): number {
    const firstStatusRank = first.scheduleStatus === 'ongoing' ? 0 : 1;
    const secondStatusRank = second.scheduleStatus === 'ongoing' ? 0 : 1;

    if (firstStatusRank !== secondStatusRank) {
      return firstStatusRank - secondStatusRank;
    }

    return this.getProgramTimestamp(first) - this.getProgramTimestamp(second);
  }

  private getProgramTimestamp(program: HomeProgram): number {
    const date = program.startDate || '';
    const time = program.startTime || '00:00';
    const timestamp = Date.parse(`${date}T${time}`);

    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  }

  private formatProgramDate(value: string): string {
    const timestamp = Date.parse(`${value}T00:00:00`);

    if (!Number.isFinite(timestamp)) {
      return 'Date TBA';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  }

  private toPopularCourse(course: PublicCourseApiItem): PopularCourse {
    const price = this.toNumber(course.price);
    const originalPrice = this.getOriginalPrice(course.oldPrice, price);
    const discount = this.getDiscountPercent(price, originalPrice);

    return {
      id: `${course.id}`,
      title: course.title,
      image: course.thumbnailUrl || this.placeholderCourseImage,
      badge: discount > 0 ? `-${discount}%` : 'Active',
      badgeSuffix: discount > 0 ? 'Off' : 'Course',
      lessons: this.getLessonsCount(course),
      students: this.getStudentsCount(course),
      reviews: this.getReviewCount(course),
      description:
        course.description || 'Build practical skills with a focused, instructor-led program.',
      author: course.instructorName || 'ICTEL Instructor',
      authorImage: this.placeholderAuthorImage,
      category: course.categoryName || 'Course',
      price,
      originalPrice,
      actionLabel: 'Enroll Now',
      actionIcon: 'feather-arrow-right',
      route: this.loginRoute,
    };
  }

  private toBannerCourse(course: PublicCourseApiItem): BannerCourse {
    const price = this.toNumber(course.price);
    const originalPrice = this.getOriginalPrice(course.oldPrice, price);
    const discount = this.getDiscountPercent(price, originalPrice);

    return {
      id: `${course.id}`,
      title: course.title,
      image: course.thumbnailUrl || this.placeholderCourseImage,
      badge: discount > 0 ? `-${discount}%` : 'Featured',
      badgeSuffix: discount > 0 ? 'Off' : 'Course',
      lessons: this.getLessonsCount(course),
      students: this.getStudentsCount(course),
      reviews: this.getReviewCount(course),
      price,
      originalPrice,
      description:
        course.description || 'Learn through practical sessions and career-focused guidance.',
    };
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
      value: '50000',
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

  readonly placementCompanies: PlacementCompany[] = [
    {
      name: 'TCS',
      logo: 'assets/images/placements/tcs.svg',
      sector: 'IT Services',
      accent: '#5f259f',
    },
    {
      name: 'Wipro',
      logo: 'assets/images/placements/wipro.svg',
      sector: 'Technology Consulting',
      accent: '#6d3adf',
    },
    {
      name: 'Deloitte',
      logo: 'assets/images/placements/deloitte.svg',
      sector: 'Consulting',
      accent: '#86bc25',
    },
    {
      name: 'Tech Mahindra',
      logo: 'assets/images/placements/tech-mahindra.svg',
      sector: 'Digital Transformation',
      accent: '#dd1f26',
    },
    {
      name: 'Cognizant',
      logo: 'assets/images/placements/cognizant.svg',
      sector: 'Technology Services',
      accent: '#0033a0',
    },
    {
      name: 'Accenture',
      logo: 'assets/images/placements/accenture.svg',
      sector: 'Consulting',
      accent: '#a100ff',
    },
    {
      name: 'Infosys',
      logo: 'assets/images/placements/infosys.svg',
      sector: 'Digital Services',
      accent: '#007cc3',
    },
    {
      name: 'HCLTech',
      logo: 'assets/images/placements/hcltech.svg',
      sector: 'Engineering & Cloud',
      accent: '#0066b3',
    },
    {
      name: 'Capgemini',
      logo: 'assets/images/placements/capgemini.svg',
      sector: 'Consulting & Technology',
      accent: '#00a3e0',
    },
    {
      name: 'IBM',
      logo: 'assets/images/placements/ibm.svg',
      sector: 'Cloud & AI',
      accent: '#0f62fe',
    },
    {
      name: 'LTIMindtree',
      logo: 'assets/images/placements/ltimindtree.svg',
      sector: 'Technology Consulting',
      accent: '#fb4f14',
    },
    {
      name: 'Mphasis',
      logo: 'assets/images/placements/mphasis.svg',
      sector: 'IT Solutions',
      accent: '#e21b2d',
    },
  ];

  readonly newsletterCounters: NewsletterCounter[] = [
    {
      value: '500',
      title: 'Successfully Trained',
      subtitle: 'Practical project learners',
      iconClass: 'feather-users',
    },
    {
      value: '100',
      title: 'Certified Students',
      subtitle: 'Career-ready credentials',
      iconClass: 'feather-award',
    },
    {
      value: '12',
      title: 'Hiring Brands',
      subtitle: 'Placement-focused exposure',
      iconClass: 'feather-briefcase',
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
