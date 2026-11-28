import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDetailResponse } from '../../models/prescription-api.model';
import { PrescriptionApiService } from '../../services/prescription-api.service';
import { PrescriptionLiveEditor } from './prescription-live-editor';
import { HttpErrorResponse } from '@angular/common/http';

describe('Prescription live editor', () => {
  const doctorId = '11111111-1111-4111-8111-111111111111';
  const prescriptionId = '22222222-2222-4222-8222-222222222222';

  function draft(ownerId = doctorId): PrescriptionDetailResponse {
    return {
      prescription: {
        id: prescriptionId,
        patient_user_id: '33333333-3333-4333-8333-333333333333',
        consultation_id: null,
        prescriber_user_id: ownerId,
        source: 'doctor',
        claimed_prescriber: null,
        review_status: 'not_reviewed',
        reviewed_by: null,
        reviewed_at: null,
        status: 'draft',
        issued_at: null,
        starts_on: null,
        ends_on: null,
        previous_prescription_id: null,
        original_document_id: null,
        created_by: ownerId,
        created_at: '2026-11-27T10:00:00Z',
        updated_at: '2026-11-27T10:00:00Z',
        version: 3,
        status_reason: null,
      },
      items: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          prescription_id: prescriptionId,
          medicine_id: '55555555-5555-4555-8555-555555555555',
          medicine_name_snapshot: 'Synthetic medicine',
          dose_text: 'Synthetic dose',
          route: null,
          frequency: 'Synthetic frequency',
          duration_days: null,
          instructions: null,
          quantity: '1.125',
          quantity_unit: 'tablet',
          is_prn: false,
          created_at: '2026-11-27T10:00:00Z',
        },
      ],
      reviews: [],
    };
  }

  async function createPage(result: PrescriptionDetailResponse, creating = false) {
    const update = vi.fn();
    const deleteDraft = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue(result);
    const get = vi.fn().mockResolvedValue(result);
    TestBed.configureTestingModule({
      imports: [PrescriptionLiveEditor],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: creating ? 'new' : prescriptionId })),
            queryParamMap: of(
              convertToParamMap(
                creating
                  ? {
                      patientId: result.prescription.patient_user_id,
                      consultationId: '77777777-7777-4777-8777-777777777777',
                    }
                  : {},
              ),
            ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getOwnProfile: vi.fn().mockResolvedValue({
              user: { id: doctorId },
              roles: ['doctor'],
            }),
          },
        },
        {
          provide: PrescriptionApiService,
          useValue: {
            get,
            update,
            create,
            deleteDraft,
          },
        },
      ],
    });

    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles(doctorId, ['doctor']);
    roles.setActiveRole('Doctor');

    const fixture = TestBed.createComponent(PrescriptionLiveEditor);
    fixture.detectChanges();

    await vi.waitFor(() => {
      fixture.detectChanges();

      expect(fixture.componentInstance.state()).not.toBe('loading');
    });

    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, update, create, get, deleteDraft };
  }

  it('loads an owned draft without losing decimal quantity or medicine identity', async () => {
    const result = draft();
    const { fixture } = await createPage(result);
    const component = fixture.componentInstance;

    expect(component.state()).toBe('ready');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();

    const item = component.form.controls.items.at(0).getRawValue();

    expect(item.quantity).toBe('1.125');
    expect(item.medicine_id).toBe(result.items[0].medicine_id);
    expect(item.duration_days).toBeNull();
  });

  it('blocks editing and saving another doctor’s draft', async () => {
    const { fixture, update } = await createPage(draft('66666666-6666-4666-8666-666666666666'));

    expect(fixture.nativeElement.textContent).toContain('This prescription is read-only');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    fixture.componentInstance.reviewDraft();
    await fixture.componentInstance.saveDraft();

    expect(update).not.toHaveBeenCalled();
  });
  it('saves reviewed content using the loaded version', async () => {
    const result = draft();
    const { fixture, update } = await createPage(result);
    const component = fixture.componentInstance;

    update.mockResolvedValue(result);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.form.controls.items
      .at(0)
      .controls.instructions.setValue('Updated synthetic instructions.');

    component.reviewDraft();

    const reviewed = component.review();

    expect(reviewed).not.toBeNull();
    expect(reviewed?.items[0].quantity).toBe('1.125');
    expect(reviewed?.items[0].medicine_id).toBe(result.items[0].medicine_id);

    await component.saveDraft();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(prescriptionId, 3, reviewed);

    expect(navigate).toHaveBeenCalledWith(['/workspace/doctor/prescriptions', prescriptionId]);

    expect(component.saving()).toBe(false);
  });
  it('requires a reload after a version conflict and prevents another save', async () => {
    const { fixture, update } = await createPage(draft());
    const component = fixture.componentInstance;

    update.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        statusText: 'Conflict',
      }),
    );

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.reviewDraft();

    expect(component.review()).not.toBeNull();

    await component.saveDraft();
    fixture.detectChanges();

    expect(component.needsReload()).toBe(true);
    expect(component.review()).toBeNull();
    expect(component.saving()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'This draft has changed or can no longer be edited.',
    );
    expect(fixture.nativeElement.textContent).toContain('Reload draft');

    await component.saveDraft();

    expect(update).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('creates a new draft and opens the returned prescription', async () => {
    const result = draft();
    const { fixture, create, get, update } = await createPage(result, true);
    const component = fixture.componentInstance;

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(component.creating()).toBe(true);
    expect(get).not.toHaveBeenCalled();

    component.form.controls.items.at(0).patchValue({
      medicine_name_snapshot: 'New synthetic medicine',
      dose_text: 'Synthetic dose',
      frequency: 'Synthetic frequency',
      quantity: '2.125',
      quantity_unit: 'tablet',
    });

    component.reviewDraft();

    const reviewed = component.review();

    expect(reviewed).not.toBeNull();
    expect(reviewed?.consultation_id).toBe('77777777-7777-4777-8777-777777777777');
    expect(reviewed?.items[0].quantity).toBe('2.125');
    expect(reviewed?.items[0].medicine_id).toBeNull();

    await component.saveDraft();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(result.prescription.patient_user_id, reviewed);
    expect(update).not.toHaveBeenCalled();

    expect(navigate).toHaveBeenCalledWith([
      '/workspace/doctor/prescriptions',
      result.prescription.id,
    ]);
  });
  it('does not delete without confirmation', async () => {
    const { fixture, deleteDraft } = await createPage(draft());

    await fixture.componentInstance.confirmDelete();

    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it('deletes a confirmed draft and returns to the patient list', async () => {
    const result = draft();
    const { fixture, deleteDraft } = await createPage(result);
    const component = fixture.componentInstance;

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.deleteRequested.set(true);

    await component.confirmDelete();

    expect(deleteDraft).toHaveBeenCalledTimes(1);
    expect(deleteDraft).toHaveBeenCalledWith(result.prescription.id);

    expect(component.deleted()).toBe(true);
    expect(component.detail()).toBeNull();
    expect(component.form.controls.items.length).toBe(0);

    expect(navigate).toHaveBeenCalledWith(['/workspace/doctor/prescriptions'], {
      queryParams: {
        patientId: result.prescription.patient_user_id,
        consultationId: result.prescription.consultation_id,
      },
    });
  });
  it('checks the patient list after an uncertain create without submitting again', async () => {
    const result = draft();
    const { fixture, create } = await createPage(result, true);
    const component = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    create.mockRejectedValue(new HttpErrorResponse({ status: 0 }));

    component.form.controls.items.at(0).patchValue({
      medicine_name_snapshot: 'Synthetic timeout test',
      dose_text: 'Synthetic dose',
      frequency: 'Synthetic frequency',
    });

    component.reviewDraft();
    expect(component.review()).not.toBeNull();

    await component.saveDraft();
    fixture.detectChanges();

    expect(component.needsReload()).toBe(true);
    expect(component.saving()).toBe(false);
    expect(component.review()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Check prescription list');
    expect(navigate).not.toHaveBeenCalled();

    component.reviewDraft();
    await component.saveDraft();

    expect(component.review()).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const checkList = buttons.find((button) =>
      button.textContent?.includes('Check prescription list'),
    );

    expect(checkList).toBeDefined();
    checkList!.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/workspace/doctor/prescriptions'], {
      queryParams: {
        patientId: result.prescription.patient_user_id,
        consultationId: '77777777-7777-4777-8777-777777777777',
      },
    });
    expect(component.needsReload()).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
