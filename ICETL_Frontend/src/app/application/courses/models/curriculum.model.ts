export interface Section {
  id: number;
  courseId: number;
  title: string;
  objective: string;
  sortOrder: number;
  expanded: boolean;
  items: CurriculumItem[];
}

export interface CurriculumItem {
  id: number;
  sectionId: number;
  title: string;
  type: string;
  contentType: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  fileUrl: string;
  duration: string;
  description: string;
  passingPercentage?: number | null;
  timeLimit?: number | null;
  allowMultipleAttempts?: number | boolean | null;
  maxAttempts?: number | null;
  isPreview: boolean;
  sortOrder: number;
}
