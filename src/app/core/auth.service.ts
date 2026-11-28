import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firstValueFrom, timeout } from 'rxjs';
import { ActiveRoleService } from './context/active-role.service';
import { ActiveOrganizationService } from './context/active-organization.service';

export interface MediLinkConfig {
  firebase: FirebaseOptions;
  authEmulatorUrl?: string;
  apiBaseUrl: string;
}

export class OnboardingRequestError extends Error {
  constructor(readonly originalError: unknown) {
    super('The account was created, but profile setup did not finish.');
    this.name = 'OnboardingRequestError';
  }
}

export interface MembershipResponse {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  verified_at: string | null;
  created_at: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string | null;
    display_name: string;
    phone: string | null;
    status: string;
  };
  roles: string[];
  memberships: MembershipResponse[];
  patient_profile: {
    user_id: string;
    date_of_birth: string;
    sex: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    notification_preferences: Record<string, boolean>;
  } | null;
  professional_profile: {
    user_id: string;
    role: 'doctor' | 'pharmacist' | 'lab_staff';
    doctor_reference: string | null;
    registration_number: string | null;
    workplace: string | null;
    qualifications: string | null;
    specialty: string | null;
    verification_status: string;
    created_at: string;
    updated_at: string;
  } | null;
}

declare global {
  interface Window {
    medilinkConfig?: MediLinkConfig;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly roleContext = inject(ActiveRoleService);
  private readonly organizationContext = inject(ActiveOrganizationService);
  private readonly connectedEmulators = new WeakSet<Auth>();

  private async firebase(): Promise<{ auth: Auth; config: MediLinkConfig }> {
    if (!isPlatformBrowser(this.platform) || !window.medilinkConfig?.firebase?.apiKey) {
      throw new Error('Authentication is not configured.');
    }
    const config = window.medilinkConfig;
    const app: FirebaseApp =
      getApps().find((item) => item.name === 'medilink') ??
      initializeApp(config.firebase, 'medilink');
    const auth = getAuth(app);
    if (config.authEmulatorUrl && !this.connectedEmulators.has(auth)) {
      connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
      this.connectedEmulators.add(auth);
    }
    await setPersistence(auth, browserLocalPersistence);
    return { auth, config };
  }

  private async authorizedRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const { auth, config } = await this.firebase();
    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Please sign in to continue.');
    }

    const token = await auth.currentUser.getIdToken();
    const url = `${config.apiBaseUrl}/${path.replace(/^\//, '')}`;
    const options = { headers: { ...headers, Authorization: `Bearer ${token}` } };
    const request =
      method === 'GET'
        ? this.http.get<T>(url, options)
        : method === 'PUT'
          ? this.http.put<T>(url, body ?? {}, options)
          : this.http.post<T>(url, body ?? {}, options);

    return firstValueFrom(request.pipe(timeout(10000)));
  }

  private async authorizationHeaders(): Promise<{
    url: string;
    headers: { Authorization: string };
  }> {
    const { auth, config } = await this.firebase();
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('Please sign in to continue.');
    const token = await auth.currentUser.getIdToken();
    return {
      url: config.apiBaseUrl,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  postAuthorizedForm<T>(path: string, body: FormData): Promise<T> {
    return this.authorizationHeaders().then(({ url, headers }) =>
      firstValueFrom(
        this.http
          .post<T>(`${url}/${path.replace(/^\//, '')}`, body, { headers })
          .pipe(timeout(30000)),
      ),
    );
  }

  getAuthorizedBlob(path: string): Promise<Blob> {
    return this.authorizationHeaders().then(({ url, headers }) =>
      firstValueFrom(
        this.http
          .get(`${url}/${path.replace(/^\//, '')}`, {
            headers,
            responseType: 'blob',
          })
          .pipe(timeout(30000)),
      ),
    );
  }

  getAuthorized<T>(path: string): Promise<T> {
    return this.authorizedRequest<T>('GET', path);
  }

  postAuthorized<T>(path: string, body: unknown): Promise<T> {
    return this.authorizedRequest<T>('POST', path, body);
  }

  postAuthorizedWithKey<T>(path: string, body: unknown, key: string): Promise<T> {
    return this.authorizedRequest<T>('POST', path, body, { 'Idempotency-Key': key });
  }

  putAuthorized<T>(path: string, body: unknown): Promise<T> {
    return this.authorizedRequest<T>('PUT', path, body);
  }

  async getOwnProfile(): Promise<MeResponse> {
    const { auth, config } = await this.firebase();

    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Please sign in to view your profile.');
    }

    const token = await auth.currentUser.getIdToken();

    return firstValueFrom(
      this.http
        .get<MeResponse>(`${config.apiBaseUrl}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .pipe(timeout(10000)),
    );
  }
  async updateOwnAccount(input: { name: string; phone: string }): Promise<MeResponse> {
    const { auth, config } = await this.firebase();

    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Please sign in to update your profile.');
    }

    const token = await auth.currentUser.getIdToken();

    return firstValueFrom(
      this.http
        .patch<MeResponse>(
          `${config.apiBaseUrl}/me`,
          {
            display_name: input.name.trim(),
            phone: input.phone.trim() || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .pipe(timeout(10000)),
    );
  }

  async updateEmergencyContact(input: {
    name: string;
    phone: string;
  }): Promise<NonNullable<MeResponse['patient_profile']>> {
    const { auth, config } = await this.firebase();

    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Please sign in to update your emergency contact.');
    }

    const token = await auth.currentUser.getIdToken();

    return firstValueFrom(
      this.http
        .patch<NonNullable<MeResponse['patient_profile']>>(
          `${config.apiBaseUrl}/me/patient-profile`,
          {
            emergency_contact_name: input.name.trim() || null,
            emergency_contact_phone: input.phone.trim() || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .pipe(timeout(10000)),
    );
  }

  async updateNotificationPreferences(input: {
    medication_in_app: boolean;
    vaccination_in_app: boolean;
  }): Promise<NonNullable<MeResponse['patient_profile']>> {
    const { auth, config } = await this.firebase();

    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Please sign in to update your preferences.');
    }

    const token = await auth.currentUser.getIdToken();

    return firstValueFrom(
      this.http
        .patch<NonNullable<MeResponse['patient_profile']>>(
          `${config.apiBaseUrl}/me/patient-profile`,
          {
            notification_preferences: {
              medication_in_app: input.medication_in_app,
              vaccination_in_app: input.vaccination_in_app,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .pipe(timeout(10000)),
    );
  }

  async restoreSession(): Promise<boolean> {
    try {
      const { auth, config } = await this.firebase();

      await auth.authStateReady();

      if (!auth.currentUser) {
        this.roleContext.clear();
        this.organizationContext.clear();
        return false;
      }

      const token = await auth.currentUser.getIdToken();

      const response = await firstValueFrom(
        this.http
          .get<MeResponse>(`${config.apiBaseUrl}/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .pipe(timeout(10000)),
      );

      this.roleContext.setAccountRoles(response.user.id, response.roles);
      this.organizationContext.setAccountMemberships(response.user.id, response.memberships);

      return true;
    } catch (error) {
      this.roleContext.clear();
      this.organizationContext.clear();
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { auth, config } = await this.firebase();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      const token = await credential.user.getIdToken();
      await firstValueFrom(
        this.http
          .get(`${config.apiBaseUrl}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .pipe(timeout(10000)),
      );
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  }

  async registrationAvailable(
    field: 'email' | 'phone',
    value: string,
  ): Promise<{ available: boolean; recoverable: boolean }> {
    const { config } = await this.firebase();
    const result = await firstValueFrom(
      this.http
        .post<{ available: boolean; recoverable: boolean }>(
          `${config.apiBaseUrl}/registration/availability`,
          {
            field,
            value,
          },
        )
        .pipe(timeout(10000)),
    );
    return result;
  }

  async registerPatient(input: {
    email: string;
    password: string;
    displayName: string;
    phone: string;
    dateOfBirth: string;
    sex: 'female' | 'male';
    recoverExisting?: boolean;
  }): Promise<void> {
    return this.registerAccount({
      ...input,
      requestedRole: 'patient',
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
    });
  }

  async registerProfessional(input: {
    email: string;
    password: string;
    displayName: string;
    phone: string;
    requestedRole: 'doctor' | 'pharmacist' | 'lab_staff';
    professionalRegistrationNumber: string;
    workplace: string;
    recoverExisting?: boolean;
  }): Promise<void> {
    return this.registerAccount(input);
  }

  private async registerAccount(input: {
    email: string;
    password: string;
    displayName: string;
    phone: string;
    requestedRole: 'patient' | 'doctor' | 'pharmacist' | 'lab_staff';
    dateOfBirth?: string;
    sex?: 'female' | 'male';
    professionalRegistrationNumber?: string;
    workplace?: string;
    recoverExisting?: boolean;
  }): Promise<void> {
    const { auth, config } = await this.firebase();
    await auth.authStateReady();
    const email = input.email.trim();

    const credential = input.recoverExisting
      ? await signInWithEmailAndPassword(auth, email, input.password)
      : await createUserWithEmailAndPassword(auth, email, input.password);
    try {
      const token = await credential.user.getIdToken();
      const onboarding: Record<string, string> = {
        display_name: input.displayName.trim(),
        phone: input.phone.trim(),
        requested_role: input.requestedRole,
      };
      if (input.requestedRole === 'patient') {
        onboarding['date_of_birth'] = input.dateOfBirth ?? '';
        onboarding['sex'] = input.sex ?? '';
      } else {
        onboarding['professional_registration_number'] =
          input.professionalRegistrationNumber?.trim() ?? '';
        onboarding['workplace'] = input.workplace?.trim() ?? '';
      }
      try {
        await firstValueFrom(
          this.http
            .post(`${config.apiBaseUrl}/me/onboard`, onboarding, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .pipe(timeout(10000)),
        );
      } catch (error) {
        throw new OnboardingRequestError(error);
      }
    } catch (error) {
      // Keep the Firebase session so a failed backend onboarding can be retried.
      throw error;
    }
  }
}
