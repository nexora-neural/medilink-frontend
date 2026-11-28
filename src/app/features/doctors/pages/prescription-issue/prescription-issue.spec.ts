import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDraftPreviewStore } from '../../../prescriptions/services/prescription-draft-preview.store';
import { PrescriptionIssue } from './prescription-issue';
import { IssueReview, issueProblems } from './prescription-issue.models';
import {
  PRESCRIPTION_ISSUE,
  PrescriptionIssuePreviewStore,
  sampleReview,
} from './prescription-issue.store';

describe('ML-117 doctor review and issue', () => {
  let fixture: ComponentFixture<PrescriptionIssue>;
  let component: PrescriptionIssue;
  let roles: ActiveRoleService;
  let value: IssueReview;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let port: { load: ReturnType<typeof vi.fn>; issue: ReturnType<typeof vi.fn> };
  async function setup(preview = '', role = 'doctor') {
    value = sampleReview();
    params = new BehaviorSubject(convertToParamMap({ id: 'sample-order' }));
    query = new BehaviorSubject(convertToParamMap(preview ? { preview } : {}));
    port = {
      load: vi.fn().mockImplementation(async () => structuredClone(value)),
      issue: vi
        .fn()
        .mockImplementation(async () => ({ ...structuredClone(value), status: 'active' })),
    };
    await TestBed.configureTestingModule({
      imports: [PrescriptionIssue],
      providers: [
        provideRouter([]),
        { provide: PRESCRIPTION_ISSUE, useValue: port },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            queryParamMap: query,
            snapshot: { paramMap: params.value, queryParamMap: query.value },
          },
        },
      ],
    }).compileComponents();
    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('sample-doctor', [role]);
    fixture = TestBed.createComponent(PrescriptionIssue);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function acknowledge() {
    component.review()!.items.forEach((item) => component.markItem(item.id, true));
    component.acknowledged.set(true);
    fixture.detectChanges();
  }
  const text = () => fixture.nativeElement.textContent as string;

  it('shows every item, all instructions and warnings without issuing on load', async () => {
    await setup();
    for (const item of value.items) {
      expect(text()).toContain(item.medicineName);
      expect(text()).toContain(item.instructions);
      expect(text()).toContain(item.dose);
      expect(text()).toContain(item.frequency);
    }
    for (const warning of value.warnings) expect(text()).toContain(warning);
    expect(text()).toContain('No');
    expect(text()).toContain('Yes');
    expect(port.issue).not.toHaveBeenCalled();
  });
  it('requires every item and global acknowledgment', async () => {
    await setup();
    component.markItem(value.items[0].id, true);
    component.acknowledged.set(true);
    expect(component.canIssue()).toBe(false);
    acknowledge();
    expect(component.canIssue()).toBe(true);
    component.markItem(value.items[0].id, false);
    expect(component.canIssue()).toBe(false);
  });
  it('requires explicit confirmation and supports cancellation without mutation', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    expect(component.dialog()).toBe(true);
    expect(port.issue).not.toHaveBeenCalled();
    component.closeConfirmation();
    await component.confirmIssue();
    expect(port.issue).not.toHaveBeenCalled();
    expect(component.review()?.status).toBe('draft');
  });
  it('confirms active only after response and prevents a second issue', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    await component.confirmIssue();
    fixture.detectChanges();
    expect(port.issue).toHaveBeenCalledExactlyOnceWith('sample-order');
    expect(component.review()?.status).toBe('active');
    expect(text()).toContain('No clinical order was issued');
    component.openConfirmation();
    await component.confirmIssue();
    expect(port.issue).toHaveBeenCalledTimes(1);
  });
  for (const scenario of ['unverified', 'denied', 'invalid']) {
    it(`blocks issuance for ${scenario}`, async () => {
      await setup(scenario);
      acknowledge();
      component.openConfirmation();
      expect(component.canIssue()).toBe(false);
      expect(component.problems().length).toBeGreaterThan(0);
      expect(component.dialog()).toBe(false);
      expect(port.issue).not.toHaveBeenCalled();
    });
  }
  for (const scenario of ['loading', 'empty', 'error']) {
    it(`renders ${scenario} without an issue action`, async () => {
      await setup(scenario);
      expect(component.state()).toBe(scenario);
      expect(component.canIssue()).toBe(false);
      expect(port.issue).not.toHaveBeenCalled();
    });
  }
  it('retries a load failure without exposing private errors', async () => {
    await setup();
    port.load.mockRejectedValueOnce(new Error('private patient stack'));
    await component.load();
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(text()).not.toContain('private patient stack');
    await component.load();
    expect(component.state()).toBe('ready');
  });
  it('shows safe mutation failure and allows retry', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    port.issue.mockRejectedValueOnce(new Error('private backend trace'));
    await component.confirmIssue();
    fixture.detectChanges();
    expect(component.review()?.status).toBe('draft');
    expect(component.dialog()).toBe(true);
    expect(text()).toContain('Unable to issue');
    expect(text()).not.toContain('private backend trace');
    expect(component.message()).toBe('');
    await component.confirmIssue();
    expect(component.review()?.status).toBe('active');
  });
  it('rejects a response that does not confirm the active state', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    port.issue.mockResolvedValueOnce(value);
    await component.confirmIssue();
    expect(component.actionError()).toContain('Unable to issue');
    expect(component.review()?.status).toBe('draft');
  });
  it('blocks duplicate clicks and cancellation while saving', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    let resolve!: (value: IssueReview) => void;
    port.issue.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const pending = component.confirmIssue();
    await component.confirmIssue();
    component.closeConfirmation();
    expect(port.issue).toHaveBeenCalledTimes(1);
    expect(component.dialog()).toBe(true);
    resolve({ ...value, status: 'active' });
    await pending;
    expect(component.review()?.status).toBe('active');
  });
  it('denies a non-doctor without loading records', async () => {
    await setup('', 'patient');
    expect(component.state()).toBe('denied');
    expect(port.load).not.toHaveBeenCalled();
    expect(component.review()).toBeNull();
  });
  it('clears records and ignores in-flight results when role is lost', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    let resolve!: (value: IssueReview) => void;
    port.issue.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const pending = component.confirmIssue();
    roles.clear();
    fixture.detectChanges();
    resolve({ ...value, status: 'active' });
    await pending;
    expect(component.review()).toBeNull();
    expect(component.dialog()).toBe(false);
    expect(component.message()).toBe('');
  });
  it('ignores issue responses after destruction', async () => {
    await setup();
    acknowledge();
    component.openConfirmation();
    let resolve!: (value: IssueReview) => void;
    port.issue.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const pending = component.confirmIssue();
    fixture.destroy();
    resolve({ ...value, status: 'active' });
    await pending;
    expect(component.message()).toBe('');
  });
  it('focuses the dialog, dismisses with Escape and restores the opener', async () => {
    await setup();
    acknowledge();
    const button = fixture.nativeElement.querySelector(
      '.issue-actions button',
    ) as HTMLButtonElement;
    button.focus();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.dialog()).toBe(false);
    expect(document.activeElement).toBe(button);
  });
  it('clears acknowledgments on reload so a changed draft must be reviewed again', async () => {
    await setup();
    acknowledge();
    await component.load();
    expect(component.reviewedItems()).toEqual([]);
    expect(component.acknowledged()).toBe(false);
  });
});

describe('ML-117 issue validation and sample state', () => {
  it('rejects incomplete and invalid item data', () => {
    for (const patch of [
      { dose: '' },
      { medicineName: ' ' },
      { route: '' },
      { frequency: '' },
      { durationDays: 1.5 },
      { quantity: 0 },
      { quantity: NaN },
      { quantityUnit: '' },
    ]) {
      const review = sampleReview();
      Object.assign(review.items[0], patch);
      expect(issueProblems(review).length).toBeGreaterThan(0);
    }
  });
  it('rejects wrong source, missing consultation, no items and invalid dates', () => {
    for (const patch of [
      { source: 'patient' },
      { ownerDoctor: false },
      { consultationId: '' },
      { prescriptionGrant: false },
      { items: [] },
      { startsOn: '2026-02-30' },
      { endsOn: '2020-01-01' },
    ]) {
      expect(issueProblems(Object.assign(sampleReview(), patch)).length).toBeGreaterThan(0);
    }
  });
  it('retains active preview state on reload and is idempotent for repeated issue', async () => {
    const store = new PrescriptionIssuePreviewStore(new PrescriptionDraftPreviewStore());
    expect(await store.load('unknown')).toBeNull();
    await expect(store.issue('unknown')).rejects.toThrow();
    expect((await store.issue('sample-order')).status).toBe('active');
    expect((await store.load('sample-order'))?.status).toBe('active');
    expect((await store.issue('sample-order')).status).toBe('active');
  });
});
