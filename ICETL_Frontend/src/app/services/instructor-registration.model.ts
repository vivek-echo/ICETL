export type InstructorFlowType = 'new' | 'resume' | 'roleUpgrade';

export interface DropdownOption {
  itemId: number;
  itemText: string;
}

export interface InstructorRegistrationResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface InstructorOnboardingUser {
  id: number;
  code?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  hasPassword?: boolean;
}

export interface InstructorOnboardingSession {
  token: string;
  expiresAt?: string;
  user: InstructorOnboardingUser;
}

export interface InstructorDocumentRecord {
  id: number;
  userId: number;
  documentType: string;
  originalName?: string;
  fileName?: string;
  filePath: string;
  fileUrl: string | null;
}

export interface InstructorProfileUser {
  id: number;
  code?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  hasPassword?: boolean;
}

export interface InstructorProfile {
  id: number;
  code?: string | null;
  userId: number;
  dob?: string | null;
  gender?: string | null;
  headline?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
  currentJobTitle?: string | null;
  currentOrganization?: string | null;
  qualification?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  youtubeUrl?: string | null;
  portfolioUrl?: string | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  approvalStatus: string;
  status: number;
  profilePhotoUrl?: string | null;
  skills: string[];
  categories: string[];
  languagesYouCanTeach: string[];
  documents: InstructorDocumentRecord[];
  user?: InstructorProfileUser;
}

export interface InstructorOtpStartData {
  email: string;
  flowType: InstructorFlowType;
  currentStep: number;
  expiresIn: number;
  resendAvailableIn: number;
  otp?: string | number | null;
}

export interface InstructorOtpVerificationResult {
  flowType: InstructorFlowType;
  currentStep: number;
  onboardingAuth: InstructorOnboardingSession;
  instructor: InstructorProfile;
}

export interface InstructorStepResponseData {
  currentStep: number;
  instructor: InstructorProfile;
}

export interface InstructorFinalRegistrationData {
  currentStep: number;
  onboardingCompleted: boolean;
  instructor: InstructorProfile;
}

export interface SaveAccountInformationPayload {
  fullName: string;
  mobileNumber: string;
  gender: string;
  dob: string;
  password?: string;
  confirmPassword?: string;
  country: string;
  preferredLanguage: string;
}

export interface SaveProfessionalInformationPayload {
  professionalHeadline: string;
  bio: string;
  yearsOfExperience: number;
  currentJobTitle: string;
  currentOrganization: string;
  highestQualification: string;
}

export interface SaveProfessionalInformationFormValue extends SaveProfessionalInformationPayload {
  profilePhoto?: File | null;
}

export interface SaveSkillsAndCategoriesPayload {
  skills: string[];
  teachingCategories: string[];
  languagesYouCanTeach: string[];
}

export interface SaveDocumentsAndSocialLinksPayload {
  linkedInUrl?: string;
  gitHubUrl?: string;
  youTubeUrl?: string;
  portfolioWebsite?: string;
}

export interface SaveDocumentsAndSocialLinksFormValue extends SaveDocumentsAndSocialLinksPayload {
  governmentId?: File | null;
  resume?: File | null;
  certifications?: File[];
}

export interface CompleteInstructorOnboardingPayload {
  acceptTerms: boolean;
  acceptInstructorPolicy: boolean;
  verifyInformation: boolean;
}

export const INSTRUCTOR_REGISTRATION_ENDPOINTS = {
  sendOtp: '/instructors/send-otp',
  resendOtp: '/instructors/resend-otp',
  verifyOtp: '/instructors/verify-otp',
  saveAccountInformation: '/instructors/account-information',
  saveProfessionalInformation: '/instructors/professional-information',
  saveSkillsAndCategories: '/instructors/skills-and-categories',
  saveDocumentsAndSocialLinks: '/instructors/documents-and-social-links',
  completeOnboarding: '/instructors/complete-onboarding',
  profile: '/instructors/profile',
} as const;
