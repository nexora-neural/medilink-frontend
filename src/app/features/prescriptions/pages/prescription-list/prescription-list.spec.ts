import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDraftPreviewStore } from '../../services/prescription-draft-preview.store';
import { PrescriptionList } from './prescription-list';

describe('PrescriptionList local favourites and renewal preview', () => {
  let fixture: ComponentFixture<PrescriptionList>;
  let component: PrescriptionList;
  let store: PrescriptionDraftPreviewStore;
  let roles: ActiveRoleService;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function render(): void {
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    query = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [PrescriptionList],
      providers: [
        provideRouter([]),
        PrescriptionDraftPreviewStore,
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: query.asObservable() },
        },
      ],
    }).compileComponents();

    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('sample-account', ['doctor', 'patient']);
    roles.setActiveRole('Doctor');
    store = TestBed.inject(PrescriptionDraftPreviewStore);
    fixture = TestBed.createComponent(PrescriptionList);
    component = fixture.componentInstance;
    render();
  });

  it('shows empty library states and only offers renewal for an owned eligible prescription', () => {
    expect(text()).toContain('No favourites saved yet.');
    expect(text()).toContain('No templates saved yet.');
    expect(component.canRenew(store.find('sample-active-01')!)).toBe(true);
    expect(component.canRenew(store.find('sample-other-owner-01')!)).toBe(false);
    expect(component.canRenew(store.find('sample-draft-01')!)).toBe(false);
  });

  it('requires a reason and creates only an editable renewal draft', async () => {
    const original = store.find('sample-active-01')!;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.openRenewal(original);

    await component.createRenewalDraft(original);
    expect(component.renewalError()).toContain('reason');
    expect(store.list()).toHaveLength(5);
    expect(navigate).not.toHaveBeenCalled();

    component.renewalReason.set('Doctor review requested for a sample renewal.');
    await component.createRenewalDraft(original);

    const draft = store.list().find((item) => item.previousPrescriptionId === original.id);
    expect(draft?.status).toBe('draft');
    expect(draft?.items).toEqual(original.items);
    expect(draft?.ownerDoctorId).toBe(original.ownerDoctorId);
    expect(store.find(original.id)?.status).toBe('active');
    expect(navigate).toHaveBeenCalledWith(['/workspace/doctor/prescriptions', draft?.id, 'edit']);
  });

  it.each(['loading', 'empty', 'error', 'denied'])(
    'does not expose prescription actions during the %s state',
    (state) => {
      query.next(convertToParamMap({ preview: state }));
      render();

      expect(component.prescriptions()).toEqual([]);
      expect(text()).not.toContain('Prepare renewal draft');
    },
  );

  it('does not allow a non-doctor role to open a renewal draft', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    roles.setActiveRole('Patient');
    render();
    const active = store.find('sample-active-01')!;

    component.openRenewal(active);
    component.renewalReason.set('Sample request');
    await component.createRenewalDraft(active);

    expect(store.list()).toHaveLength(5);
    expect(navigate).not.toHaveBeenCalled();
  });
});
