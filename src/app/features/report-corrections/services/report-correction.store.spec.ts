import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { LabReport } from '../models/report-correction.models';
import { ReportCorrectionStore } from './report-correction.store';

// Test-only record. Production stores are not seeded with this report.
const uploadedReport = (): LabReport => ({
  id: 'LR-1',
  patient: 'Nadeesha Perera',
  request: 'LAB-123',
  type: 'Full blood count',
  date: '2026-11-24',
  reference: 'LAB-123',
  notes: '',
  file: 'original.pdf',
  url: 'blob:original',
  mime: 'application/pdf',
  status: 'Published',
  version: 1,
});

describe('report correction store', () => {
  let store: ReportCorrectionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    store = TestBed.inject(ReportCorrectionStore);

    TestBed.inject(ActiveRoleService).setAccountRoles('test-lab-user', ['lab_staff']);

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    store.ngOnDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const prepare = () => {
    store.setReports([uploadedReport()], {
      'LR-1': { correct: true, withdraw: true },
    });

    store.select('LR-1');
    store.resetDraft();

    store.correctionDraft = {
      ...store.correctionDraft,
      file: 'replacement.pdf',
      url: 'blob:replacement',
      mime: 'application/pdf',
    };

    store.correctionReason = 'Corrected report';
  };

  it('clears workspace state and cancels correction on same-account role switches', () => {
    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('test-lab-user', ['lab_staff', 'patient']);

    for (const nextRole of ['Patient', 'Lab Staff'] as const) {
      store.base =
        roles.activeRole() === 'Patient'
          ? '/workspace/patient/reports'
          : '/workspace/lab-staff/reports';

      prepare();
      store.dirty = true;
      store.reviewCorrection();
      store.correct();

      expect(store.pending).toBe(true);

      roles.setActiveRole(nextRole);

      expect(store.reports).toEqual([]);
      expect(store.selectedId).toBe('');
      expect(store.correctionDraft.file).toBe('');
      expect(store.correctionReason).toBe('');
      expect(store.showConfirm).toBe(false);
      expect(store.dirty).toBe(false);
      expect(store.pending).toBe(false);

      vi.advanceTimersByTime(400);

      expect(store.reports).toEqual([]);
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();

      // Reusing an ID cannot recover permissions from the previous workspace.
      store.base =
        nextRole === 'Patient' ? '/workspace/patient/reports' : '/workspace/lab-staff/reports';
      store.setReports([uploadedReport()], {});
      store.select('LR-1');

      expect(store.canCorrect).toBe(false);
      expect(store.canWithdraw).toBe(false);
    }
  });

  it('clears state and cancels withdrawal when a same-account role is removed', () => {
    const roles = TestBed.inject(ActiveRoleService);

    for (const remainingRoles of [['patient'], ['lab_staff']]) {
      roles.setAccountRoles('test-lab-user', ['lab_staff', 'patient']);
      roles.setActiveRole('Lab Staff');
      store.base = '/workspace/lab-staff/reports';
      prepare();

      store.dirty = true;
      store.reviewWithdrawal();
      store.withdraw();

      expect(store.pending).toBe(true);

      roles.setAccountRoles('test-lab-user', remainingRoles);

      expect(store.reports).toEqual([]);
      expect(store.selectedId).toBe('');
      expect(store.correctionDraft.file).toBe('');
      expect(store.correctionReason).toBe('');
      expect(store.showConfirm).toBe(false);
      expect(store.dirty).toBe(false);
      expect(store.pending).toBe(false);

      vi.advanceTimersByTime(400);

      expect(store.reports).toEqual([]);
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();

      store.base =
        roles.activeRole() === 'Patient'
          ? '/workspace/patient/reports'
          : '/workspace/lab-staff/reports';
      store.setReports([uploadedReport()], {});
      store.select('LR-1');

      expect(store.canCorrect).toBe(false);
      expect(store.canWithdraw).toBe(false);
    }
  });

  it('starts with the same empty reports collection as the reference', () => {
    expect(store.reports).toEqual([]);
    expect(store.selected).toBeUndefined();
    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('does not enable actions without explicit integration capabilities', () => {
    store.setReports([uploadedReport()], {});
    store.select('LR-1');

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('retains the complete original file and creates a linked corrected version', () => {
    prepare();

    const original = { ...store.selected! };

    store.reviewCorrection();
    store.correct();

    vi.advanceTimersByTime(400);

    expect(store.reports[1]).toEqual({
      ...original,
      status: 'Superseded',
    });

    expect(store.reports[0]).toMatchObject({
      previous: original.id,
      version: 2,
      file: 'replacement.pdf',
      url: 'blob:replacement',
      status: 'Published',
      reason: 'Corrected report',
    });

    store.select(store.reports[0].id);
    store.resetDraft();

    expect(store.canCorrect).toBe(true);
  });

  it('withdraws without removing its file or previous version link', () => {
    const report = {
      ...uploadedReport(),
      previous: 'LR-0',
      version: 2,
    };

    store.setReports([report], {
      'LR-1': { correct: true, withdraw: true },
    });

    store.select(report.id);
    store.resetDraft();
    store.correctionReason = 'Wrong file';

    store.reviewWithdrawal();
    store.withdraw();

    vi.advanceTimersByTime(400);

    expect(store.selected).toEqual({
      ...report,
      status: 'Withdrawn',
      reason: 'Wrong file',
    });

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('validates the correction reason and required replacement before review', () => {
    prepare();

    store.correctionReason = '   ';
    store.reviewCorrection();

    expect(store.showConfirm).toBe(false);
    expect(store.messageKind).toBe('error');

    store.correctionReason = 'Correction';
    store.correctionDraft.file = '';
    store.reviewCorrection();

    expect(store.showConfirm).toBe(false);
    expect(store.reports).toHaveLength(1);
  });

  it('retains draft entries after an offline save failure', () => {
    prepare();
    store.reviewCorrection();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    store.correct();

    vi.advanceTimersByTime(400);

    expect(store.messageKind).toBe('error');
    expect(store.pending).toBe(false);
    expect(store.correctionDraft.file).toBe('replacement.pdf');
    expect(store.correctionReason).toBe('Corrected report');
    expect(store.reports).toHaveLength(1);
  });

  it('allows a patient with explicit capabilities in the patient workspace', () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('test-patient', ['patient']);

    store.base = '/workspace/patient/reports';

    prepare();

    expect(store.canCorrect).toBe(true);
    expect(store.canWithdraw).toBe(true);
  });

  it('blocks patient actions in the laboratory workspace', () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('test-patient', ['patient']);

    prepare();

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('blocks laboratory actions in the patient workspace', () => {
    store.base = '/workspace/patient/reports';

    prepare();

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('blocks other roles even when capabilities are supplied', () => {
    const roles = TestBed.inject(ActiveRoleService);

    for (const role of ['doctor', 'pharmacist', 'admin', 'super_admin']) {
      roles.setAccountRoles('test-' + role, [role]);

      // Supply capabilities for the current account to verify the role check.
      prepare();

      expect(store.canCorrect).toBe(false);
      expect(store.canWithdraw).toBe(false);
    }
  });

  it('clears data and blocks direct actions after an account switch', () => {
    prepare();

    store.reviewCorrection();

    expect(store.showConfirm).toBe(true);

    TestBed.inject(ActiveRoleService).setAccountRoles('test-doctor', ['doctor']);

    store.correct();
    store.withdraw();

    vi.advanceTimersByTime(400);

    expect(store.reports).toEqual([]);
    expect(store.selectedId).toBe('');
    expect(store.selected).toBeUndefined();
    expect(store.showConfirm).toBe(false);
    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('blocks actions after logout', () => {
    prepare();

    TestBed.inject(ActiveRoleService).clear();

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('clears report data, selection and draft state on logout', () => {
    prepare();

    store.laboratory = 'Previous laboratory';
    store.dirty = true;
    store.loading = true;
    store.loadError = 'Previous error';

    store.reviewCorrection();
    store.setMessage('Previous account message', 'error');

    TestBed.inject(ActiveRoleService).clear();

    expect(store.reports).toEqual([]);
    expect(store.selectedId).toBe('');
    expect(store.selected).toBeUndefined();
    expect(store.laboratory).toBe('Central Laboratory');

    expect(store.correctionDraft).toEqual({
      type: '',
      date: '',
      reference: '',
      notes: '',
      file: '',
      url: '',
      mime: '',
    });

    expect(store.correctionReason).toBe('');
    expect(store.message).toBe('');
    expect(store.messageKind).toBe('success');
    expect(store.showConfirm).toBe(false);
    expect(store.pending).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.loadError).toBe('');
    expect(store.dirty).toBe(false);
    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('isolates accounts even when both have the same role', () => {
    prepare();

    TestBed.inject(ActiveRoleService).setAccountRoles('second-lab-user', ['lab_staff']);

    expect(store.reports).toEqual([]);
    expect(store.selected).toBeUndefined();
    expect(store.correctionReason).toBe('');
    expect(store.correctionDraft.file).toBe('');

    // Reusing an ID must not restore the previous account's capabilities.
    store.setReports([uploadedReport()], {});
    store.select('LR-1');

    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });

  it('cancels a pending correction when the account changes', () => {
    prepare();

    store.reviewCorrection();
    store.correct();

    expect(store.pending).toBe(true);

    TestBed.inject(ActiveRoleService).setAccountRoles('second-lab-user', ['lab_staff']);

    vi.advanceTimersByTime(400);

    expect(store.pending).toBe(false);
    expect(store.reports).toEqual([]);
    expect(store.message).toBe('');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('cancels a pending withdrawal on logout', () => {
    prepare();

    store.reviewWithdrawal();
    store.withdraw();

    expect(store.pending).toBe(true);

    TestBed.inject(ActiveRoleService).clear();

    vi.advanceTimersByTime(400);

    expect(store.pending).toBe(false);
    expect(store.reports).toEqual([]);
    expect(store.message).toBe('');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('retains reports when roles are refreshed for the same account', () => {
    prepare();

    const original = { ...store.selected! };

    TestBed.inject(ActiveRoleService).setAccountRoles('test-lab-user', ['lab_staff']);

    expect(store.reports).toEqual([original]);
    expect(store.selectedId).toBe('LR-1');
    expect(store.canCorrect).toBe(true);
  });

  it('releases owned replacement-file URLs on logout', () => {
    const createObjectURL = vi.fn(() => 'blob:test-replacement');
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    prepare();

    const file = new File(['replacement'], 'replacement.pdf', {
      type: 'application/pdf',
    });

    store.chooseFile({
      target: {
        files: [file],
        value: '',
      },
    } as unknown as Event);

    expect(store.correctionDraft.url).toBe('blob:test-replacement');

    TestBed.inject(ActiveRoleService).clear();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-replacement');
    expect(store.correctionDraft.url).toBe('');
  });

  it('releases saved replacement-file URLs when accounts change', () => {
    const createObjectURL = vi.fn(() => 'blob:saved-replacement');
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    prepare();

    const file = new File(['replacement'], 'replacement.pdf', {
      type: 'application/pdf',
    });

    store.chooseFile({
      target: {
        files: [file],
        value: '',
      },
    } as unknown as Event);

    store.reviewCorrection();
    store.correct();

    vi.advanceTimersByTime(400);

    expect(store.reports[0].url).toBe('blob:saved-replacement');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    TestBed.inject(ActiveRoleService).setAccountRoles('second-lab-user', ['lab_staff']);

    expect(store.reports).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:saved-replacement');
  });
});
