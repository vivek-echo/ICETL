import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, AuthService } from './auth.service';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  profileImg?: string | null;
  thumbnailImg?: string | null;
  coverImg?: string | null;
  profileImgUrl?: string | null;
  thumbnailImgUrl?: string | null;
  coverImgUrl?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly apiBaseUrl = environment.apiUrl;
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);
  private readonly isBrowser: boolean;

  readonly profile$ = this.profileSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadProfileFromStorage();

    if (this.isBrowser) {
      window.addEventListener('auth-user-updated', this.handleAuthUserUpdated);
      window.addEventListener('auth-session-cleared', this.handleAuthSessionCleared);
    }
  }

  get currentProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  getUserProfileData(): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(`${this.apiBaseUrl}/user-profile`).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.setProfile(response.data);
        }
      }),
    );
  }

  updateUserProfileData(payload: FormData): Observable<ApiResponse<UserProfile>> {
    return this.http.post<ApiResponse<UserProfile>>(`${this.apiBaseUrl}/user-profile`, payload).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.setProfile(response.data);
        }
      }),
    );
  }

  clearProfile(): void {
    this.profileSubject.next(null);
  }

  setProfile(profile: UserProfile): void {
    const resolvedProfile = this.withResolvedMediaUrls(profile);
    this.profileSubject.next(resolvedProfile);
    this.authService.updateStoredUser(resolvedProfile as unknown as Record<string, unknown>);
  }

  loadProfileFromStorage(): UserProfile | null {
    if (!this.authService.isLoggedIn()) {
      this.profileSubject.next(null);
      return null;
    }

    const storedUser = this.authService.getUser() as Partial<UserProfile>;

    if (!storedUser?.id && !storedUser?.email) {
      this.profileSubject.next(null);
      return null;
    }

    const profile = {
      id: Number(storedUser.id ?? 0),
      name: storedUser.name || 'Learner',
      email: storedUser.email || '',
      phone: storedUser.phone ?? null,
      dob: storedUser.dob ?? null,
      gender: storedUser.gender ?? null,
      profileImg: storedUser.profileImg ?? null,
      thumbnailImg: storedUser.thumbnailImg ?? null,
      coverImg: storedUser.coverImg ?? null,
      profileImgUrl:
        storedUser.profileImgUrl ?? this.getStoredFileUrl('profile', storedUser.profileImg),
      thumbnailImgUrl:
        storedUser.thumbnailImgUrl ?? this.getStoredFileUrl('thumbnail', storedUser.thumbnailImg),
      coverImgUrl: storedUser.coverImgUrl ?? this.getStoredFileUrl('cover', storedUser.coverImg),
    };

    this.profileSubject.next(profile);

    return profile;
  }

  getStoredFileUrl(type: 'profile' | 'thumbnail' | 'cover', fileName?: string | null): string | null {
    if (!fileName) {
      return null;
    }

    if (/^https?:\/\//i.test(fileName) || fileName.startsWith('data:')) {
      return fileName;
    }

    return this.buildPrivateFileUrl(`uploads/user/${type}/${fileName}`);
  }

  getAfile(path: string, download = false): Observable<Blob> {
    const normalizedPath = path.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    return this.http.get(`${this.apiBaseUrl}/getAfile`, {
      headers: this.authService.getAuthHeaders(),
      params: {
        path: normalizedPath,
        ...(download ? { download: '1' } : {}),
      },
      responseType: 'blob',
    });
  }

  downloadPrivateFile(path: string, fileName: string): Observable<void> {
    return this.getAfile(path, true).pipe(
      tap((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = objectUrl;
        link.download = fileName;
        link.click();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }),
      map(() => void 0),
    );
  }

  buildPrivateFileUrl(path: string): string {
    return `${this.apiBaseUrl}/getAfile?path=${encodeURIComponent(
      path.trim().replace(/\\/g, '/').replace(/^\/+/, ''),
    )}`;
  }

  private withResolvedMediaUrls(profile: UserProfile): UserProfile {
    return {
      ...profile,
      profileImgUrl: profile.profileImgUrl ?? this.getStoredFileUrl('profile', profile.profileImg),
      thumbnailImgUrl:
        profile.thumbnailImgUrl ?? this.getStoredFileUrl('thumbnail', profile.thumbnailImg),
      coverImgUrl: profile.coverImgUrl ?? this.getStoredFileUrl('cover', profile.coverImg),
    };
  }

  private readonly handleAuthUserUpdated = (): void => {
    this.loadProfileFromStorage();
  };

  private readonly handleAuthSessionCleared = (): void => {
    this.clearProfile();
  };
}
