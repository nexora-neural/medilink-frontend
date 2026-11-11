import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firstValueFrom, timeout } from 'rxjs';

export interface MediLinkConfig {
  firebase: FirebaseOptions;
  apiBaseUrl: string;
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
  patient_profile: {
    user_id: string;
    date_of_birth: string;
    sex: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    notification_preferences: Record<string, boolean>;
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

  private async firebase(): Promise<{ auth: Auth; config: MediLinkConfig }> {
    if (!isPlatformBrowser(this.platform) || !window.medilinkConfig?.firebase?.apiKey) {
      throw new Error('Authentication is not configured.');
    }
    const config = window.medilinkConfig;
    const app: FirebaseApp =
      getApps().find((item) => item.name === 'medilink') ??
      initializeApp(config.firebase, 'medilink');
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return { auth, config };
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

  async restoreSession(): Promise<boolean> {
    const { auth, config } = await this.firebase();
    await auth.authStateReady();
    if (!auth.currentUser) return false;
    const token = await auth.currentUser.getIdToken();
    await firstValueFrom(
      this.http
        .get(`${config.apiBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(timeout(10000)),
    );
    return true;
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

  async registerPatient(input: {
    email: string;
    password: string;
    displayName: string;
    phone: string;
    dateOfBirth: string;
    sex: 'female' | 'male';
  }): Promise<void> {
    const { auth, config } = await this.firebase();
    await auth.authStateReady();
    const email = input.email.trim();

    const credential = await (async () => {
      try {
        return await createUserWithEmailAndPassword(auth, email, input.password);
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;

        if (code !== 'auth/email-already-in-use') {
          throw error;
        }

        return signInWithEmailAndPassword(auth, email, input.password);
      }
    })();
    try {
      const token = await credential.user.getIdToken();
      await firstValueFrom(
        this.http
          .post(
            `${config.apiBaseUrl}/me/onboard`,
            {
              display_name: input.displayName,
              phone: input.phone,
              requested_role: 'patient',
              date_of_birth: input.dateOfBirth,
              sex: input.sex,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .pipe(timeout(10000)),
      );
    } catch (error) {
      // Keep the Firebase session so a failed backend onboarding can be retried.
      throw error;
    }
  }
}
