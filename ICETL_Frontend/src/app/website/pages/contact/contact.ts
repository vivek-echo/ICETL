import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ContactCard {
  title: string;
  iconClass: string;
  lines: string[];
}

interface ContactFeature {
  title: string;
  description: string;
  iconClass: string;
}

interface ContactFaq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-contact',
  imports: [RouterLink],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class ContactComponent {
  readonly coursesRoute = '/courses';
  readonly contactEmail = 'info@ictel.in';
  readonly supportEmail = 'support@ictel.in';

  readonly contactImages = [
    'assets/images/contact/contact1.png',
    'assets/images/contact/contact2.png',
  ];

  readonly courseOptions = [
    'Programming',
    'Web Development',
    'AI & Data Science',
    'Cloud Computing',
    'Cyber Security',
    'Networking',
    'Digital Marketing',
    'CAD Training',
  ];

  readonly contactCards: ContactCard[] = [
    {
      title: 'Visit Us',
      iconClass: 'fa-solid fa-location-dot',
      lines: [' Ice Technology Lab', 'Anjali Apartment, Mitra Compound, Boring Road, Patna - 800001'],
    },
    {
      title: 'Call Us',
      iconClass: 'fa-solid fa-phone',
      lines: ['+91 8797078611 , +91 8797078612'],
    },
    {
      title: 'Email Us',
      iconClass: 'fa-solid fa-envelope',
      lines: ['info@ictel.in', 'support@ictel.in'],
    },
    {
      title: 'Working Hours',
      iconClass: 'fa-solid fa-clock',
      lines: ['Monday - Saturday', '9:00 AM - 6:00 PM'],
    },
  ];

  readonly whyContactCards: ContactFeature[] = [
    {
      title: 'Course Guidance',
      description: 'Get help choosing the right training path for your skills and career goals.',
      iconClass: 'fa-solid fa-route',
    },
    {
      title: 'Career Counseling',
      description: 'Talk with our team about roles, roadmaps, interviews, and practical next steps.',
      iconClass: 'fa-solid fa-compass',
    },
    {
      title: 'Internship Support',
      description: 'Understand internship options, project exposure, and profile-building support.',
      iconClass: 'fa-solid fa-user-check',
    },
    {
      title: 'Certification Assistance',
      description: 'Get guidance on certification-focused learning and course completion details.',
      iconClass: 'fa-solid fa-certificate',
    },
    {
      title: 'Technical Support',
      description: 'Reach us for learner support, access help, and training-related technical queries.',
      iconClass: 'fa-solid fa-headset',
    },
    {
      title: 'Admission Help',
      description: 'Ask about batches, fees, enrollment steps, schedules, and course availability.',
      iconClass: 'fa-solid fa-file-signature',
    },
  ];

  readonly faqs: ContactFaq[] = [
    {
      question: 'How do I enroll in a course?',
      answer:
        'Share your details through the contact form or call the ICTEL team. We will guide you through course selection, batch availability, and enrollment steps.',
    },
    {
      question: 'Do you provide certificates?',
      answer:
        'Yes. ICTEL provides certificates for eligible learners after successful course completion, based on the program requirements.',
    },
    {
      question: 'Are internships included?',
      answer:
        'Internship support is available for selected programs. Our team can explain the options connected to your chosen training domain.',
    },
    {
      question: 'Do you offer online classes?',
      answer:
        'ICTEL supports flexible learning formats for selected courses. Contact our team to confirm online or blended options for your preferred program.',
    },
    {
      question: 'What are the course durations?',
      answer:
        'Course duration depends on the selected program, level, and batch schedule. Our counselors can share the latest duration details before enrollment.',
    },
    {
      question: 'How can I contact support?',
      answer:
        'You can contact support by emailing support@ictel.in, calling the listed phone numbers, or sending your query through the contact form.',
    },
  ];

  readonly activeFaqIndex = signal<number | null>(0);

  toggleFaq(index: number): void {
    this.activeFaqIndex.set(this.activeFaqIndex() === index ? null : index);
  }

  handleContactSubmit(event: Event): void {
    event.preventDefault();
  }
}
