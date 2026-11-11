import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService, MeResponse } from '../../../../core/auth.service';
import { PatientProfile } from './patient-profile';

function profileResponse(name = 'Demo Patient'): MeResponse {
  return {
    user: {
      id: 'demo-patient-001',
      email: 'patient@example.com',
      display_name: name,
      phone: '0771234567',
      status: 'active',
    },
    roles: ['patient'],
    memberships: [],
    patient_profile: {
      user_id: 'demo-patient-001',
      date_of_birth: '2000-01-01',
      sex: 'female',
      emergency_contact_name: null,
      emergency_contact_phone: null,
      notification_preferences: {},
    },
  };
}

describe('PatientProfile', () => {
  let component: PatientProfile;
  let fixture: ComponentFixture<PatientProfile>;

  const auth = {
    getOwnProfile: vi.fn<() => Promise<MeResponse>>(),
    updateOwnAccount: vi.fn<(input: { name: string; phone: string }) => Promise<MeResponse>>(),
  };

  beforeEach(async () => {
    auth.getOwnProfile.mockReset();
    auth.updateOwnAccount.mockReset();

    auth.getOwnProfile.mockResolvedValue(profileResponse());

    await TestBed.configureTestingModule({
      imports: [PatientProfile],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientProfile);
    component = fixture.componentInstance;
  });

  it('loads and displays the signed-in profile', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);
    expect(component.patient()?.name).toBe('Demo Patient');
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Demo Patient');
  });

  it('shows a load error and allows retrying', async () => {
    auth.getOwnProfile.mockRejectedValueOnce(new Error('Network error'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.patient()).toBeNull();

    const alert: HTMLElement | null = fixture.nativeElement.querySelector('[role="alert"]');

    expect(alert?.textContent).toContain('Your profile could not be loaded');

    const retryButton = alert?.querySelector('button');
    expect(retryButton).not.toBeNull();

    retryButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.getOwnProfile).toHaveBeenCalledTimes(2);
    expect(component.loadError()).toBe('');
    expect(component.patient()?.name).toBe('Demo Patient');
  });

  it('updates the displayed profile after a successful save', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.editProfile();

    auth.updateOwnAccount.mockResolvedValue(profileResponse('Updated Patient'));

    await component.saveProfile({
      name: 'Updated Patient',
      email: 'patient@example.com',
      phone: '0771234567',
    });

    fixture.detectChanges();

    expect(auth.updateOwnAccount).toHaveBeenCalledWith({
      name: 'Updated Patient',
      phone: '0771234567',
    });
    expect(component.patient()?.name).toBe('Updated Patient');
    expect(component.isEditing).toBe(false);
    expect(component.saving()).toBe(false);
    expect(component.saveError()).toBe('');
  });

  it('keeps the draft and allows retrying after a failed save', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.editProfile();
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#profile-name');

    nameInput.value = 'Unsaved Patient';
    nameInput.dispatchEvent(new Event('input'));

    auth.updateOwnAccount.mockRejectedValueOnce(new Error('Network error'));

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.updateOwnAccount).toHaveBeenCalledTimes(1);
    expect(component.patient()?.name).toBe('Demo Patient');
    expect(component.isEditing).toBe(true);
    expect(component.saving()).toBe(false);
    expect(nameInput.value).toBe('Unsaved Patient');
    expect(fixture.nativeElement.textContent).toContain('Your changes could not be saved');

    auth.updateOwnAccount.mockResolvedValue(profileResponse('Unsaved Patient'));

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.updateOwnAccount).toHaveBeenCalledTimes(2);
    expect(component.patient()?.name).toBe('Unsaved Patient');
    expect(component.isEditing).toBe(false);
    expect(component.saveError()).toBe('');
  });
});
