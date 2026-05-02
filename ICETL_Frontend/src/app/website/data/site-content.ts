export interface NavChild {
  label: string;
  route: string;
  description: string;
}

export interface NavItem {
  label: string;
  route?: string;
  exact?: boolean;
  children?: NavChild[];
}

export interface MenuSection {
  title: string;
  links: Array<{
    label: string;
    route: string;
  }>;
}

export interface HeaderCategoryPanel {
  id: string;
  label: string;
  sections: MenuSection[];
  cta?: {
    label: string;
    route: string;
  };
}

export interface CategoryCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  courseCount: number;
  route: string;
}

export interface Course {
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

export interface HighlightItem {
  title: string;
  description: string;
  iconClass: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  quote: string;
}

export interface Statistic {
  value: string;
  label: string;
  detail: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  iconClass: string;
}

export interface ProgressItem {
  id: string;
  courseTitle: string;
  mentor: string;
  progress: number;
  nextLesson: string;
  image: string;
  route: string;
}

export interface SessionItem {
  id: string;
  title: string;
  time: string;
  format: string;
  instructor: string;
}

export interface FooterLink {
  label: string;
  route?: string;
  href?: string;
}

export interface FooterLinkGroup {
  title: string;
  links: FooterLink[];
}

export const MAIN_NAVIGATION: NavItem[] = [
  {
    label: 'Home',
    route: '/',
    exact: true,
  },
  {
    label: 'Courses',
    route: '/courses',
  },
  {
    label: 'Dashboard',
    route: '/dashboard',
  },
  {
    label: 'Resources',
    children: [
      {
        label: 'Browse Programs',
        route: '/courses',
        description: 'Explore catalog sections, learning paths, and featured cohorts.',
      },
      {
        label: 'Student Workspace',
        route: '/dashboard',
        description: 'Track progress, upcoming sessions, and certifications in one place.',
      },
      {
        label: 'Get Started',
        route: '/',
        description: 'Return to the main landing experience and onboarding calls to action.',
      },
    ],
  },
];

export const HEADER_CATEGORY_PANELS: HeaderCategoryPanel[] = [
  {
    id: 'development',
    label: 'Development',
    sections: [
      {
        title: 'Frontend',
        links: [
          { label: 'Angular Architecture', route: '/courses' },
          { label: 'React Systems', route: '/courses' },
          { label: 'TypeScript Foundations', route: '/courses' },
          { label: 'Design Systems', route: '/courses' },
        ],
      },
      {
        title: 'Backend',
        links: [
          { label: 'REST API Design', route: '/courses' },
          { label: 'Laravel for Teams', route: '/courses' },
          { label: 'Testing Strategy', route: '/courses' },
          { label: 'System Design', route: '/courses' },
        ],
      },
    ],
    cta: {
      label: 'Explore Development Tracks',
      route: '/courses',
    },
  },
  {
    id: 'design',
    label: 'Design',
    sections: [
      {
        title: 'Experience Design',
        links: [
          { label: 'Research Sprints', route: '/courses' },
          { label: 'Interaction Patterns', route: '/courses' },
          { label: 'Accessibility Basics', route: '/courses' },
          { label: 'Component Thinking', route: '/courses' },
        ],
      },
      {
        title: 'Creative Tools',
        links: [
          { label: 'Figma Workflow', route: '/courses' },
          { label: 'Visual Hierarchy', route: '/courses' },
          { label: 'Brand Systems', route: '/courses' },
          { label: 'Prototyping', route: '/courses' },
        ],
      },
    ],
    cta: {
      label: 'Browse Design Paths',
      route: '/courses',
    },
  },
  {
    id: 'data',
    label: 'Data & AI',
    sections: [
      {
        title: 'Analytics',
        links: [
          { label: 'Dashboard Storytelling', route: '/courses' },
          { label: 'SQL Reporting', route: '/courses' },
          { label: 'Data Visualization', route: '/courses' },
          { label: 'KPI Planning', route: '/courses' },
        ],
      },
      {
        title: 'Applied AI',
        links: [
          { label: 'Prompt Design', route: '/courses' },
          { label: 'Automation Basics', route: '/courses' },
          { label: 'AI for Teams', route: '/courses' },
          { label: 'Responsible Usage', route: '/courses' },
        ],
      },
    ],
    cta: {
      label: 'View Data & AI Courses',
      route: '/courses',
    },
  },
  {
    id: 'leadership',
    label: 'Leadership',
    sections: [
      {
        title: 'People Leadership',
        links: [
          { label: 'Manager Essentials', route: '/courses' },
          { label: 'Feedback Culture', route: '/courses' },
          { label: 'Coaching Teams', route: '/courses' },
          { label: 'Hiring Playbooks', route: '/courses' },
        ],
      },
      {
        title: 'Business Skills',
        links: [
          { label: 'Product Strategy', route: '/courses' },
          { label: 'Go-To-Market Planning', route: '/courses' },
          { label: 'Stakeholder Management', route: '/courses' },
          { label: 'Roadmap Communication', route: '/courses' },
        ],
      },
    ],
    cta: {
      label: 'See Leadership Programs',
      route: '/courses',
    },
  },
];

export const HOME_CATEGORIES: CategoryCard[] = [
  {
    id: 'development',
    title: 'Development',
    description: 'Ship modern web apps, APIs, and maintainable frontend systems.',
    icon: 'assets/images/category/server.png',
    courseCount: 25,
    route: '/courses',
  },
  {
    id: 'design',
    title: 'UX Design',
    description: 'Design flows, interfaces, and component libraries that scale.',
    icon: 'assets/images/category/design.png',
    courseCount: 18,
    route: '/courses',
  },
  {
    id: 'data',
    title: 'Data Analytics',
    description: 'Turn reporting and dashboards into practical product decisions.',
    icon: 'assets/images/category/infographic.png',
    courseCount: 14,
    route: '/courses',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Grow acquisition, retention, and campaign execution with confidence.',
    icon: 'assets/images/category/pantone.png',
    courseCount: 16,
    route: '/courses',
  },
  {
    id: 'product',
    title: 'Product',
    description: 'Connect discovery, delivery, and roadmap communication.',
    icon: 'assets/images/category/web-design.png',
    courseCount: 12,
    route: '/courses',
  },
  {
    id: 'leadership',
    title: 'Leadership',
    description: 'Lead teams, mentor peers, and scale execution across functions.',
    icon: 'assets/images/category/personal.png',
    courseCount: 10,
    route: '/courses',
  },
];

export const FEATURED_COURSES: Course[] = [
  {
    id: 'angular-front-to-back',
    title: 'Angular Front To Back',
    category: 'Development',
    image: 'assets/images/course/course-03.jpg',
    lessons: 18,
    students: 320,
    reviews: 48,
    price: 69,
    originalPrice: 129,
    author: 'Angela Bruce',
    authorImage: 'assets/images/client/avatar-02.png',
    level: 'Intermediate',
    duration: '8 weeks',
    badge: '-46%',
    description: 'Build standalone Angular apps with routing, signals, forms, and reusable UI patterns.',
    route: '/courses',
  },
  {
    id: 'react-systems',
    title: 'React Frontend Systems',
    category: 'Development',
    image: 'assets/images/course/course-01.jpg',
    lessons: 20,
    students: 410,
    reviews: 61,
    price: 74,
    originalPrice: 139,
    author: 'Patrick Miles',
    authorImage: 'assets/images/client/avater-01.png',
    level: 'Advanced',
    duration: '10 weeks',
    badge: '-47%',
    description: 'Learn scalable component architecture, design systems, and performance workflows.',
    route: '/courses',
  },
  {
    id: 'product-design-sprint',
    title: 'Product Design Sprint',
    category: 'Design',
    image: 'assets/images/course/course-04.jpg',
    lessons: 16,
    students: 205,
    reviews: 32,
    price: 64,
    originalPrice: 119,
    author: 'Sophia Rivera',
    authorImage: 'assets/images/client/avatar-03.png',
    level: 'Beginner',
    duration: '6 weeks',
    badge: '-46%',
    description: 'Move from research insight to polished UI concepts and stakeholder-ready prototypes.',
    route: '/courses',
  },
  {
    id: 'marketing-playbook',
    title: 'Performance Marketing Playbook',
    category: 'Marketing',
    image: 'assets/images/course/course-05.jpg',
    lessons: 14,
    students: 280,
    reviews: 29,
    price: 59,
    originalPrice: 109,
    author: 'Lena Hart',
    authorImage: 'assets/images/client/avatar-04.png',
    level: 'Intermediate',
    duration: '5 weeks',
    badge: '-45%',
    description: 'Build repeatable campaigns with sharper measurement, messaging, and growth loops.',
    route: '/courses',
  },
  {
    id: 'data-storytelling',
    title: 'Data Storytelling for Teams',
    category: 'Data',
    image: 'assets/images/course/course-06.jpg',
    lessons: 12,
    students: 190,
    reviews: 24,
    price: 54,
    originalPrice: 99,
    author: 'Marcus Lee',
    authorImage: 'assets/images/client/avatar-05.png',
    level: 'Intermediate',
    duration: '4 weeks',
    badge: '-45%',
    description: 'Translate metrics into decisions with crisp dashboards, narratives, and clear KPIs.',
    route: '/courses',
  },
  {
    id: 'team-leadership',
    title: 'Leadership for Team Leads',
    category: 'Leadership',
    image: 'assets/images/course/classic-lms-01.jpg',
    lessons: 11,
    students: 150,
    reviews: 21,
    price: 49,
    originalPrice: 89,
    author: 'Nadia Owens',
    authorImage: 'assets/images/client/avater-01.png',
    level: 'Manager',
    duration: '4 weeks',
    badge: '-44%',
    description: 'Lead one-on-ones, feedback loops, and delivery rituals without losing team trust.',
    route: '/courses',
  },
];

export const HOME_HIGHLIGHTS: HighlightItem[] = [
  {
    title: 'Mentor-led cohorts',
    description: 'Weekly expert guidance and fast feedback loops for real project work.',
    iconClass: 'fas fa-user-graduate',
  },
  {
    title: 'Outcome-driven tracks',
    description: 'Programs are organized by role, skill progression, and business outcomes.',
    iconClass: 'fas fa-bullseye',
  },
  {
    title: 'Reusable LMS structure',
    description: 'A clean Angular foundation for landing pages, catalogs, and dashboards.',
    iconClass: 'fas fa-layer-group',
  },
];

export const HOME_BENEFITS: HighlightItem[] = [
  {
    title: 'Template look, Angular behavior',
    description: 'Keep the purchased Histudy visual language while rebuilding interactions with component state.',
    iconClass: 'fas fa-code-branch',
  },
  {
    title: 'Scalable page architecture',
    description: 'Separate layout, page routes, shared UI, and content data to reduce coupling as the LMS grows.',
    iconClass: 'fas fa-sitemap',
  },
  {
    title: 'No jQuery dependency',
    description: 'Menus, dropdowns, filters, and dashboard widgets are driven with Angular bindings only.',
    iconClass: 'fas fa-ban',
  },
  {
    title: 'Ready for richer integrations',
    description: 'The structure is prepared for Swiper, Plyr, APIs, course detail pages, and auth flows later on.',
    iconClass: 'fas fa-rocket',
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'james',
    name: 'James Carter',
    role: 'Frontend Engineer',
    avatar: 'assets/images/testimonial/client-01.png',
    quote:
      'The course flow feels premium, but the Angular structure underneath is finally something our team can extend safely.',
  },
  {
    id: 'amal',
    name: 'Amal George',
    role: 'LMS Product Manager',
    avatar: 'assets/images/testimonial/client-02.png',
    quote:
      'Routing, reusable cards, and dashboard widgets made it easy to turn a static theme into a working learner experience.',
  },
  {
    id: 'nina',
    name: 'Nina Brooks',
    role: 'Design Lead',
    avatar: 'assets/images/testimonial/client-03.png',
    quote:
      'We kept the template polish without inheriting plugin bloat, which made onboarding the rest of the team much easier.',
  },
];

export const NEWSLETTER_STATS: Statistic[] = [
  {
    value: '12k+',
    label: 'Active Learners',
    detail: 'Growing through guided programs',
  },
  {
    value: '94%',
    label: 'Completion Rate',
    detail: 'Across live cohort experiences',
  },
  {
    value: '180+',
    label: 'Projects Shipped',
    detail: 'Portfolio-ready learner outcomes',
  },
  {
    value: '24/7',
    label: 'Platform Access',
    detail: 'Content available on demand',
  },
];

export const DASHBOARD_METRICS: DashboardMetric[] = [
  {
    label: 'Courses in Progress',
    value: '04',
    detail: 'Two are above 70 percent completion.',
    iconClass: 'fas fa-play-circle',
  },
  {
    label: 'Live Sessions This Week',
    value: '06',
    detail: 'Includes mentor office hours and demos.',
    iconClass: 'fas fa-video',
  },
  {
    label: 'Certificates Earned',
    value: '09',
    detail: 'Synced to the learner portfolio.',
    iconClass: 'fas fa-certificate',
  },
  {
    label: 'Average Study Streak',
    value: '18d',
    detail: 'Strong weekly momentum across tracks.',
    iconClass: 'fas fa-fire',
  },
];

export const DASHBOARD_PROGRESS: ProgressItem[] = [
  {
    id: 'progress-angular',
    courseTitle: 'Angular Front To Back',
    mentor: 'Angela Bruce',
    progress: 78,
    nextLesson: 'Signals in larger application state',
    image: 'assets/images/course/course-03.jpg',
    route: '/courses',
  },
  {
    id: 'progress-design',
    courseTitle: 'Product Design Sprint',
    mentor: 'Sophia Rivera',
    progress: 54,
    nextLesson: 'Turning research into component flows',
    image: 'assets/images/course/course-04.jpg',
    route: '/courses',
  },
  {
    id: 'progress-data',
    courseTitle: 'Data Storytelling for Teams',
    mentor: 'Marcus Lee',
    progress: 31,
    nextLesson: 'Building narrative dashboards from raw KPIs',
    image: 'assets/images/course/course-06.jpg',
    route: '/courses',
  },
];

export const UPCOMING_SESSIONS: SessionItem[] = [
  {
    id: 'session-1',
    title: 'Angular architecture review',
    time: 'Mon · 09:30 AM',
    format: 'Live workshop',
    instructor: 'Angela Bruce',
  },
  {
    id: 'session-2',
    title: 'Design critique for course landing pages',
    time: 'Wed · 01:00 PM',
    format: 'Group feedback',
    instructor: 'Sophia Rivera',
  },
  {
    id: 'session-3',
    title: 'Analytics office hours',
    time: 'Fri · 04:15 PM',
    format: 'Ask-me-anything',
    instructor: 'Marcus Lee',
  },
];

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Home', route: '/' },
      { label: 'Courses', route: '/courses' },
      { label: 'Dashboard', route: '/dashboard' },
    ],
  },
  {
    title: 'Quick Links',
    links: [
      { label: 'Learning Paths', route: '/courses' },
      { label: 'Student Workspace', route: '/dashboard' },
      { label: 'Launch Program', route: '/' },
    ],
  },
];
