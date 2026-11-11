import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, MeResponse } from '../../../../../../core/auth.service';
import { EmergencyContactCard } from './emergency-contact-card';

type PatientProfile = NonNullable<MeResponse['patient_profile']>;

function savedProfile(
  name: string | null = 'Demo Contact',
  phone: string | null = '0770000000',
): PatientProfile {
  return {
    user_id: 'demo-patient',
    date_of_birth: '2000-01-01',
    sex: 'female',
    emergency_contact_name: name,
    emergency_contact_phone: phone,
    notification_preferences: {},
  };
}

describe('EmergencyContactCard', () => {
  let fixture: ComponentFixture<EmergencyContactCard>;
  let component: EmergencyContactCard;

  const auth = {
    updateEmergencyContact:
      vi.fn<(input: { name: string; phone: string }) => Promise<PatientProfile>>(),
  };

  beforeEach(async () => {
    auth.updateEmergencyContact.mockReset();

    await TestBed.configureTestingModule({
      imports: [EmergencyContactCard],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergencyContactCard);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('contact', {
      name: 'Demo Contact',
      phone: '0770000000',
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('displays the loaded contact', () => {
    const name: HTMLInputElement = fixture.nativeElement.querySelector('#emergency-name');

    const phone: HTMLInputElement = fixture.nativeElement.querySelector('#emergency-phone');

    expect(name.value).toBe('Demo Contact');
    expect(phone.value).toBe('0770000000');
  });

  it('saves the contact and displays success', async () => {
    auth.updateEmergencyContact.mockResolvedValue(savedProfile());

    await component.save();
    fixture.detectChanges();

    expect(auth.updateEmergencyContact).toHaveBeenCalledWith({
      name: 'Demo Contact',
      phone: '0770000000',
    });

    expect(fixture.nativeElement.textContent).toContain('Emergency contact saved.');
    expect(component.form.pristine).toBe(true);
  });

  it('allows both fields to be cleared', async () => {
    component.form.setValue({ name: '', phone: '' });

    auth.updateEmergencyContact.mockResolvedValue(savedProfile(null, null));

    await component.save();

    expect(auth.updateEmergencyContact).toHaveBeenCalledWith({
      name: '',
      phone: '',
    });
    expect(component.form.getRawValue()).toEqual({
      name: '',
      phone: '',
    });
  });

  it('rejects values exceeding the length limits', async () => {
    component.form.setValue({
      name: 'a'.repeat(151),
      phone: '1'.repeat(33),
    });

    await component.save();
    fixture.detectChanges();

    expect(auth.updateEmergencyContact).not.toHaveBeenCalled();
    expect(component.form.controls.name.hasError('maxlength')).toBe(true);
    expect(component.form.controls.phone.hasError('maxlength')).toBe(true);

    expect(fixture.nativeElement.textContent).toContain('Use no more than 150 characters.');
    expect(fixture.nativeElement.textContent).toContain('Use no more than 32 characters.');
  });

  it('retains the draft after failure and allows retrying', async () => {
    component.form.setValue({
      name: 'Updated Contact',
      phone: '0770000001',
    });

    auth.updateEmergencyContact.mockRejectedValueOnce(new Error('Service unavailable'));

    await component.save();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: 'Updated Contact',
      phone: '0770000001',
    });
    expect(component.saving()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Your emergency contact could not be saved.',
    );

    auth.updateEmergencyContact.mockResolvedValue(savedProfile('Updated Contact', '0770000001'));

    await component.save();

    expect(auth.updateEmergencyContact).toHaveBeenCalledTimes(2);
    expect(component.error()).toBe('');
    expect(component.message()).toBe('Emergency contact saved.');
  });

  it('prevents duplicate saves while a request is pending', async () => {
    let finish!: (profile: PatientProfile) => void;

    auth.updateEmergencyContact.mockImplementation(
      () =>
        new Promise<PatientProfile>((resolve) => {
          finish = resolve;
        }),
    );

    const pendingSave = component.save();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    const name: HTMLInputElement = fixture.nativeElement.querySelector('#emergency-name');

    expect(button.disabled).toBe(true);
    expect(name.readOnly).toBe(true);

    await component.save();

    expect(auth.updateEmergencyContact).toHaveBeenCalledTimes(1);

    finish(savedProfile());
    await pendingSave;
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
    expect(name.readOnly).toBe(false);
  });
});
