import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth.service';
import { ProfileSummaryCard } from './components/profile-summary-card/profile-summary-card';
import { PersonalInformationCard } from './components/personal-information-card/personal-information-card';
import {
  EmergencyContact,
  EmergencyContactCard,
} from './components/emergency-contact-card/emergency-contact-card';
import {
  NotificationPreferences,
  NotificationPreferencesCard,
} from './components/notification-preferences-card/notification-preferences-card';

export interface PatientDetails {
  name: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'app-patient-profile',
  imports: [
    ProfileSummaryCard,
    PersonalInformationCard,
    EmergencyContactCard,
    NotificationPreferencesCard,
  ],
  templateUrl: './patient-profile.html',
  styleUrl: './patient-profile.scss',
})
export class PatientProfile implements OnInit {
  private readonly auth = inject(AuthService);

  readonly patient = signal<PatientDetails | null>(null);
  readonly emergencyContact = signal<EmergencyContact | null>(null);
  readonly notificationPreferences = signal<NotificationPreferences | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  isEditing = false;

  ngOnInit(): void {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');

    try {
      const response = await this.auth.getOwnProfile();

      this.patient.set({
        name: response.user.display_name,
        email: response.user.email ?? '',
        phone: response.user.phone ?? '',
      });
      const profile = response.patient_profile;

      this.emergencyContact.set(
        profile
          ? {
              name: profile.emergency_contact_name ?? '',
              phone: profile.emergency_contact_phone ?? '',
            }
          : null,
      );
      this.notificationPreferences.set(
        profile
          ? {
              medication_in_app: profile.notification_preferences['medication_in_app'] ?? false,
              vaccination_in_app: profile.notification_preferences['vaccination_in_app'] ?? false,
            }
          : null,
      );
    } catch {
      this.loadError.set('Your profile could not be loaded. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  editProfile(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    if (this.saving()) {
      return;
    }

    this.saveError.set('');
    this.isEditing = false;
  }

  async saveProfile(updated: PatientDetails): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set('');

    try {
      const response = await this.auth.updateOwnAccount({
        name: updated.name,
        phone: updated.phone,
      });

      this.patient.set({
        name: response.user.display_name,
        email: response.user.email ?? '',
        phone: response.user.phone ?? '',
      });

      this.isEditing = false;
    } catch {
      this.saveError.set('Your changes could not be saved. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
