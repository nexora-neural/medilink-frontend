import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDraftPreviewStore } from '../../services/prescription-draft-preview.store';
import { PrescriptionEditor } from './prescription-editor';

describe('PrescriptionEditor preview', () => {
  let fixture: ComponentFixture<PrescriptionEditor>;
  let component: PrescriptionEditor;
  let store: PrescriptionDraftPreviewStore;
  let roles: ActiveRoleService;

  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function render(): void {
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ id: 'sample-draft-01' }));
    query = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [PrescriptionEditor],
      providers: [
        provideRouter([]),
        PrescriptionDraftPreviewStore,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params.asObservable(),
            queryParamMap: query.asObservable(),
          },
        },
      ],
    }).compileComponents();

    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('sample-account', ['doctor', 'patient']);
    roles.setActiveRole('Doctor');

    store = TestBed.inject(PrescriptionDraftPreviewStore);
    fixture = TestBed.createComponent(PrescriptionEditor);
    component = fixture.componentInstance;

    render();
  });

  it('loads the owner draft with its medicine items', () => {
    expect(component.items.length).toBe(2);
    expect(text()).toContain('Sample patient A');
    expect(component.items.at(0).controls.medicineName.value).toBe('Sample medicine A');
  });

  it('shows edited instructions in review and retains them when returning', () => {
    component.items.at(0).controls.instructions.setValue('Updated synthetic instructions.');

    component.reviewDraft();
    render();

    expect(text()).toContain('Review sample draft');
    expect(text()).toContain('Updated synthetic instructions.');

    component.backToEditing();
    render();

    expect(component.review()).toBeNull();
    expect(component.items.at(0).controls.instructions.value).toBe(
      'Updated synthetic instructions.',
    );
  });

  it('adds a medicine and blocks review until required fields are completed', () => {
    component.addMedicine();
    component.reviewDraft();
    render();

    expect(component.items.length).toBe(3);
    expect(component.review()).toBeNull();
    expect(text()).toContain('Medicine 3: complete medicine, dose, route and frequency.');
  });

  it('removes the selected medicine while preserving the other item', () => {
    const remainingId = component.items.at(1).controls.id.value;

    component.removeMedicine(0);

    expect(component.items.length).toBe(1);
    expect(component.items.at(0).controls.id.value).toBe(remainingId);
  });

  it('saves a doctor-owned favourite and adds a fresh editable copy to the draft', () => {
    component.saveFavorite(0);
    expect(component.favorites()).toHaveLength(1);
    expect(component.favorites()[0].ownerDoctorId).toBe('sample-doctor-01');

    component.addFavorite(component.favorites()[0]);
    expect(component.items.length).toBe(3);
    expect(component.items.at(2).controls.medicineName.value).toBe('Sample medicine A');
    expect(component.items.at(2).controls.id.value).not.toBe(
      component.items.at(0).controls.id.value,
    );
    expect(component.libraryMessage()).toContain('added to this editable draft');
  });

  it('validates before saving a reusable template and can append it to a draft', () => {
    component.templateName.set('Sample set');
    component.saveTemplate();

    expect(component.templates()).toHaveLength(1);
    expect(component.templates()[0].ownerDoctorId).toBe('sample-doctor-01');
    expect(component.review()).not.toBeNull();

    component.addTemplate(component.templates()[0]);
    expect(component.items.length).toBe(4);
    expect(component.libraryMessage()).toContain('Review and edit every item');
  });

  it('does not save an invalid draft as a template', () => {
    component.templateName.set('Invalid set');
    component.items.at(0).controls.dose.setValue('');
    component.saveTemplate();

    expect(component.templates()).toEqual([]);
    expect(component.libraryError()).toContain('Complete all required fields');
    expect(component.errors()).toContain(
      'Medicine 1: complete medicine, dose, route and frequency.',
    );
  });

  it('blocks review after all medicines are removed', () => {
    component.removeMedicine(1);
    component.removeMedicine(0);
    component.reviewDraft();
    render();

    expect(component.review()).toBeNull();
    expect(text()).toContain('Add at least one medicine.');
  });

  it('blocks a zero quantity', () => {
    component.items.at(0).controls.quantity.setValue(0);
    component.reviewDraft();

    expect(component.review()).toBeNull();
    expect(component.errors()).toContain(
      'Medicine 1: enter a positive quantity and select a unit.',
    );
  });

  it('blocks an end date before the start date', () => {
    component.form.controls.endsOn.setValue('2026-11-20');
    component.reviewDraft();

    expect(component.review()).toBeNull();
    expect(component.errors()).toContain('Enter valid start and end dates in the correct order.');
  });

  it('invalidates the review when a form value changes', () => {
    component.reviewDraft();
    expect(component.review()).not.toBeNull();

    component.items.at(0).controls.dose.setValue('Changed sample dose');

    expect(component.review()).toBeNull();
  });

  it('does not save before review', () => {
    const save = vi.spyOn(store, 'save');

    component.saveDraft();

    expect(save).not.toHaveBeenCalled();
  });

  it('saves the reviewed draft and navigates to its details', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.items.at(0).controls.instructions.setValue('Saved synthetic instructions.');
    component.reviewDraft();
    component.saveDraft();

    expect(store.find('sample-draft-01')!.items[0].instructions).toBe(
      'Saved synthetic instructions.',
    );
    expect(navigate).toHaveBeenCalledWith(['/workspace/doctor/prescriptions', 'sample-draft-01']);
  });

  it.each(['sample-other-owner-01', 'sample-active-01'])('blocks editing and saving %s', (id) => {
    const save = vi.spyOn(store, 'save');
    params.next(convertToParamMap({ id }));
    render();

    component.addMedicine();
    component.reviewDraft();
    component.saveDraft();

    expect(component.editable()).toBe(false);
    expect(component.items.length).toBe(0);
    expect(text()).toContain('This prescription is read-only');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows an unavailable state for an unknown prescription', () => {
    params.next(convertToParamMap({ id: 'unknown-id' }));
    render();

    expect(component.items.length).toBe(0);
    expect(text()).toContain('Draft unavailable');
    expect(text()).not.toContain('Sample patient A');
  });

  it('clears unsaved edits and review when the Doctor role is lost', () => {
    component.items.at(0).controls.instructions.setValue('Unsaved synthetic instructions.');
    component.reviewDraft();

    roles.setActiveRole('Patient');
    render();

    expect(component.items.length).toBe(0);
    expect(component.review()).toBeNull();
    expect(text()).toContain('Access unavailable');

    roles.setActiveRole('Doctor');
    render();

    expect(component.items.at(0).controls.instructions.value).not.toBe(
      'Unsaved synthetic instructions.',
    );
    expect(component.review()).toBeNull();
  });

  it.each(['loading', 'empty', 'error', 'denied'])(
    'hides draft details and blocks changes in the %s preview',
    (preview) => {
      const save = vi.spyOn(store, 'save');
      query.next(convertToParamMap({ preview }));
      render();

      component.addMedicine();
      component.reviewDraft();
      component.saveDraft();

      expect(component.items.length).toBe(0);
      expect(component.review()).toBeNull();
      expect(text()).not.toContain('Sample patient A');
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('restores the draft after retrying the error preview', () => {
    query.next(convertToParamMap({ preview: 'error' }));
    render();

    component.retry();
    render();

    expect(component.items.length).toBe(2);
    expect(text()).toContain('Sample patient A');
  });

  it('shows a save error without navigating away', () => {
    vi.spyOn(store, 'save').mockImplementation(() => {
      throw new Error('Simulated preview failure');
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.reviewDraft();
    component.saveDraft();
    render();

    expect(text()).toContain('The sample draft could not be saved.');
    expect(navigate).not.toHaveBeenCalled();
  });
});
