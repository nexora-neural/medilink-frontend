import { Component } from '@angular/core';
import { ProfileSummaryCard } from './components/profile-summary-card/profile-summary-card';
import { PersonalInformationCard } from './components/personal-information-card/personal-information-card';

export interface PatientDetails {
  name: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'app-patient-profile',
  imports: [ProfileSummaryCard, PersonalInformationCard],
  templateUrl: './patient-profile.html',
  styleUrl: './patient-profile.scss',
})
export class PatientProfile {
  patient: PatientDetails = {
    name: 'Nadeesha Perera',
    email: 'nadeesha@example.com',
    phone: '+94 77 123 4567',
  };

  isEditing = false;

  editProfile(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  saveProfile(updated: PatientDetails): void {
    this.patient = { ...updated };
    this.isEditing = false;
  }
}
