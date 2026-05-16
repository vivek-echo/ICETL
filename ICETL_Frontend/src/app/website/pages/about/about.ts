import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AboutStat {
  value: string;
  label: string;
  iconClass: string;
}

interface AboutFeature {
  title: string;
  description: string;
  iconClass: string;
}

interface TrainingDomain {
  title: string;
  description: string;
  iconClass: string;
}

interface TimelineStep {
  title: string;
  description: string;
  iconClass: string;
}

interface AchievementCounter {
  value: string;
  label: string;
  iconClass: string;
}

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent {
  readonly coursesRoute = '/courses';
  readonly contactEmail = 'contact@icetl.com';

  readonly aboutImages = [
    'assets/images/about/about-01.png',
    'assets/images/about/about-02.png',
    'assets/images/about/about-03.png',
  ];

  readonly heroBadges = [
    { label: 'AI', iconClass: 'fa-solid fa-brain' },
    { label: 'Cloud', iconClass: 'fa-solid fa-cloud' },
    { label: 'Code', iconClass: 'fa-solid fa-code' },
  ];

  readonly whoStats: AboutStat[] = [
    { value: '10+', label: 'Categories', iconClass: 'fa-solid fa-layer-group' },
    { value: '50+', label: 'Courses', iconClass: 'fa-solid fa-graduation-cap' },
    { value: '1000+', label: 'Students', iconClass: 'fa-solid fa-user-graduate' },
    { value: 'Industry', label: 'Projects', iconClass: 'fa-solid fa-diagram-project' },
  ];

  readonly features: AboutFeature[] = [
    {
      title: 'Industry-Focused Training',
      description:
        'Curriculum designed around practical tools, workflows, and skills used in modern technology roles.',
      iconClass: 'fa-solid fa-briefcase',
    },
    {
      title: 'Live Projects & Practical Sessions',
      description:
        'Hands-on learning experiences that help learners build confidence through real project work.',
      iconClass: 'fa-solid fa-diagram-project',
    },
    {
      title: 'Internship Assistance',
      description:
        'Guided support to help students prepare for internships and gain professional exposure.',
      iconClass: 'fa-solid fa-user-check',
    },
    {
      title: 'Professional Certifications',
      description:
        'Certification-focused programs that strengthen learner profiles and validate job-ready skills.',
      iconClass: 'fa-solid fa-certificate',
    },
    {
      title: 'Expert Trainers',
      description:
        'Learn with experienced mentors who explain concepts clearly and guide practical implementation.',
      iconClass: 'fa-solid fa-chalkboard-user',
    },
    {
      title: 'Career Guidance & Support',
      description:
        'Career-focused mentoring for interview readiness, portfolio building, and confident next steps.',
      iconClass: 'fa-solid fa-compass',
    },
  ];

  readonly trainingDomains: TrainingDomain[] = [
    {
      title: 'Programming',
      description: 'Build strong coding foundations with practical problem-solving skills.',
      iconClass: 'fa-solid fa-laptop-code',
    },
    {
      title: 'Web Development',
      description: 'Create responsive frontend and backend applications for the web.',
      iconClass: 'fa-solid fa-code',
    },
    {
      title: 'AI & Data Science',
      description: 'Explore AI, machine learning, analytics, and data-driven tools.',
      iconClass: 'fa-solid fa-brain',
    },
    {
      title: 'Cloud Computing',
      description: 'Learn cloud infrastructure, deployment, and modern DevOps basics.',
      iconClass: 'fa-solid fa-cloud',
    },
    {
      title: 'Cyber Security',
      description: 'Understand ethical hacking, security practices, and digital protection.',
      iconClass: 'fa-solid fa-shield-halved',
    },
    {
      title: 'Networking',
      description: 'Develop routing, switching, infrastructure, and network support skills.',
      iconClass: 'fa-solid fa-network-wired',
    },
    {
      title: 'Mobile Development',
      description: 'Design and build mobile apps with modern interfaces and APIs.',
      iconClass: 'fa-solid fa-mobile-screen-button',
    },
    {
      title: 'Embedded Systems',
      description: 'Work with microcontrollers, IoT concepts, robotics, and smart devices.',
      iconClass: 'fa-solid fa-microchip',
    },
    {
      title: 'CAD Training',
      description: 'Learn design workflows for civil, mechanical, and technical drafting.',
      iconClass: 'fa-solid fa-drafting-compass',
    },
    {
      title: 'Digital Marketing',
      description: 'Build digital branding, SEO, social media, and campaign skills.',
      iconClass: 'fa-solid fa-bullhorn',
    },
  ];

  readonly timelineSteps: TimelineStep[] = [
    {
      title: 'Join ICTEL',
      description: 'Choose the training path that matches your career goal.',
      iconClass: 'fa-solid fa-user-plus',
    },
    {
      title: 'Learn Fundamentals',
      description: 'Build strong concepts through guided sessions and practice.',
      iconClass: 'fa-solid fa-book-open',
    },
    {
      title: 'Work on Projects',
      description: 'Apply skills through practical tasks and industry-style projects.',
      iconClass: 'fa-solid fa-diagram-project',
    },
    {
      title: 'Internship & Certification',
      description: 'Strengthen your profile with exposure and certification readiness.',
      iconClass: 'fa-solid fa-certificate',
    },
    {
      title: 'Career Growth',
      description: 'Move forward with confidence, portfolio work, and guidance.',
      iconClass: 'fa-solid fa-arrow-trend-up',
    },
  ];

  readonly achievementCounters: AchievementCounter[] = [
    { value: '1000+', label: 'Students', iconClass: 'fa-solid fa-user-graduate' },
    { value: '50+', label: 'Courses', iconClass: 'fa-solid fa-graduation-cap' },
    { value: '10+', label: 'Categories', iconClass: 'fa-solid fa-layer-group' },
    { value: '95%', label: 'Student Satisfaction', iconClass: 'fa-solid fa-star' },
  ];
}
