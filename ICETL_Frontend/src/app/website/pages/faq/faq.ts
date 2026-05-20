import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FaqCategory {
  title: string;
  description: string;
  iconClass: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqGroup {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  iconClass: string;
  items: FaqItem[];
}

@Component({
  selector: 'app-faq',
  imports: [RouterLink],
  templateUrl: './faq.html',
  styleUrl: './faq.scss',
})
export class FaqComponent {
  readonly coursesRoute = '/courses';
  readonly contactRoute = '/contact';

  readonly categories: FaqCategory[] = [
    {
      title: 'Admissions',
      description: 'Enrollment steps, batch details, eligibility, and class options.',
      iconClass: 'fa-solid fa-file-signature',
    },
    {
      title: 'Courses',
      description: 'Programs, duration, beginner support, and practical training.',
      iconClass: 'fa-solid fa-laptop-code',
    },
    {
      title: 'Certifications',
      description: 'Course completion certificates and industry-focused validation.',
      iconClass: 'fa-solid fa-certificate',
    },
    {
      title: 'Internships',
      description: 'Project exposure, internship guidance, and profile-building support.',
      iconClass: 'fa-solid fa-user-check',
    },
    {
      title: 'Payments',
      description: 'Accepted payment methods, fee guidance, and installment support.',
      iconClass: 'fa-solid fa-credit-card',
    },
    {
      title: 'Technical Support',
      description: 'Learner access, class support, and training-related assistance.',
      iconClass: 'fa-solid fa-headset',
    },
  ];

  readonly faqGroups: FaqGroup[] = [
    {
      id: 'course-training',
      eyebrow: 'Group 01',
      title: 'Course & Training',
      description: 'Understand ICTEL programs, learning formats, projects, and training depth.',
      iconClass: 'fa-solid fa-graduation-cap',
      items: [
        {
          question: 'What courses does ICTEL offer?',
          answer:
            'ICTEL offers programs in programming, web development, AI and data science, cloud computing, cyber security, networking, digital marketing, CAD, and related IT domains.',
        },
        {
          question: 'Are the courses beginner friendly?',
          answer:
            'Yes. Many courses begin with fundamentals and gradually move into practical tools, workflows, and project-based learning.',
        },
        {
          question: 'Do you provide practical training?',
          answer:
            'Yes. ICTEL focuses on hands-on sessions, guided practice, assignments, and real-world skill development.',
        },
        {
          question: 'Are live projects included?',
          answer:
            'Selected programs include live or industry-style projects so learners can apply concepts in practical scenarios.',
        },
        {
          question: 'What is the course duration?',
          answer:
            'Course duration depends on the program, level, and batch schedule. The admissions team can confirm the latest timeline before enrollment.',
        },
      ],
    },
    {
      id: 'certification-internship',
      eyebrow: 'Group 02',
      title: 'Certification & Internship',
      description: 'Learn how certificates, internships, and project exposure support your profile.',
      iconClass: 'fa-solid fa-certificate',
      items: [
        {
          question: 'Will I receive a certificate?',
          answer:
            'Yes. Eligible learners receive a certificate after completing the required course activities and assessments.',
        },
        {
          question: 'Do you provide internship support?',
          answer:
            'ICTEL provides internship guidance and support for selected programs based on the learner path and availability.',
        },
        {
          question: 'Are certifications industry-oriented?',
          answer:
            'Yes. Certifications are designed around practical skills and training outcomes relevant to modern technology roles.',
        },
        {
          question: 'Can students work on real projects?',
          answer:
            'Yes. Students can work on guided projects and practical assignments that help build confidence and portfolio value.',
        },
      ],
    },
    {
      id: 'admission-payment',
      eyebrow: 'Group 03',
      title: 'Admission & Payment',
      description: 'Find quick answers about enrollment, class formats, and fee support.',
      iconClass: 'fa-solid fa-wallet',
      items: [
        {
          question: 'How can I enroll in a course?',
          answer:
            'You can enroll by contacting ICTEL through the contact page, phone, or institute visit. Our team will guide you through the next steps.',
        },
        {
          question: 'Do you offer online classes?',
          answer:
            'Online or blended classes may be available for selected courses. Availability depends on the program and current batch schedule.',
        },
        {
          question: 'What payment methods are accepted?',
          answer:
            'ICTEL accepts common payment methods shared by the admissions team during enrollment confirmation.',
        },
        {
          question: 'Are installment options available?',
          answer:
            'Installment options may be available for selected programs. The admissions team can explain current fee plans before you join.',
        },
      ],
    },
    {
      id: 'career-support',
      eyebrow: 'Group 04',
      title: 'Career Support',
      description: 'Explore interview preparation, placement guidance, and career mentoring.',
      iconClass: 'fa-solid fa-briefcase',
      items: [
        {
          question: 'Do you provide placement assistance?',
          answer:
            'ICTEL provides placement-oriented guidance to help learners prepare for career opportunities in their chosen domain.',
        },
        {
          question: 'Will ICTEL help with interview preparation?',
          answer:
            'Yes. Learners can receive guidance on interview readiness, resumes, portfolios, and practical skill presentation.',
        },
        {
          question: 'Can working professionals join courses?',
          answer:
            'Yes. Working professionals can join suitable programs and choose from available batches based on schedule fit.',
        },
        {
          question: 'Is career guidance available?',
          answer:
            'Yes. ICTEL helps learners understand suitable learning paths, career options, and practical next steps.',
        },
      ],
    },
  ];

  readonly activeFaqKey = signal<string | null>('course-training-0');

  isFaqOpen(groupId: string, index: number): boolean {
    return this.activeFaqKey() === this.faqKey(groupId, index);
  }

  toggleFaq(groupId: string, index: number): void {
    const key = this.faqKey(groupId, index);
    this.activeFaqKey.set(this.activeFaqKey() === key ? null : key);
  }

  scrollToFaqSection(event: Event): void {
    event.preventDefault();
    document.getElementById('faq-main')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  faqPanelId(groupId: string, index: number): string {
    return `faq-panel-${groupId}-${index}`;
  }

  faqHeadingId(groupId: string, index: number): string {
    return `faq-heading-${groupId}-${index}`;
  }

  private faqKey(groupId: string, index: number): string {
    return `${groupId}-${index}`;
  }
}
