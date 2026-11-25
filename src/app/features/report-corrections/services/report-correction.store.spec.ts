import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabReport } from '../models/report-correction.models';
import { ReportCorrectionStore } from './report-correction.store';

// Test-only record, representing a report created by the reference upload form.
// No production/report store is seeded with this record.
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
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(ReportCorrectionStore);
    TestBed.inject(ActiveRoleService).setAccountRoles('test-lab-user', ['lab_staff']);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.useFakeTimers();
  });
  afterEach(() => {
    store.ngOnDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const prepare = () => {
    store.setReports([uploadedReport()], { 'LR-1': { correct: true, withdraw: true } });
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
  it('starts with the same empty reports collection as the reference', () => {
    expect(store.reports).toEqual([]);
    expect(store.selected).toBeUndefined();
    expect(store.canCorrect).toBe(false);
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
    expect(store.reports[1]).toEqual({ ...original, status: 'Superseded' });
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
    const report = { ...uploadedReport(), previous: 'LR-0', version: 2 };
    store.setReports([report], { 'LR-1': { correct: true, withdraw: true } });
    store.select(report.id);
    store.resetDraft();
    store.correctionReason = 'Wrong file';
    store.reviewWithdrawal();
    store.withdraw();
    vi.advanceTimersByTime(400);
    expect(store.selected).toEqual({ ...report, status: 'Withdrawn', reason: 'Wrong file' });
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
    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('test-patient', ['patient']);
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
    prepare();
    const roles = TestBed.inject(ActiveRoleService);
    for (const role of ['doctor', 'pharmacist', 'admin', 'super_admin']) {
      roles.setAccountRoles('test-' + role, [role]);
      expect(store.canCorrect).toBe(false);
      expect(store.canWithdraw).toBe(false);
    }
  });

  it('blocks direct actions when the active role changes after confirmation', () => {
    prepare();
    const original = { ...store.selected! };
    store.reviewCorrection();
    expect(store.showConfirm).toBe(true);
    TestBed.inject(ActiveRoleService).setAccountRoles('test-doctor', ['doctor']);
    store.correct();
    store.withdraw();
    vi.advanceTimersByTime(400);
    expect(store.reports).toEqual([original]);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('blocks actions after logout', () => {
    prepare();
    TestBed.inject(ActiveRoleService).clear();
    expect(store.canCorrect).toBe(false);
    expect(store.canWithdraw).toBe(false);
  });
});
