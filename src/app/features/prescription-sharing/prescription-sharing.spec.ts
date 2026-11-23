import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../core/context/active-role.service';
import { PrescriptionSharing } from './prescription-sharing';
import { PRESCRIPTION_SHARING } from './prescription-sharing.models';
import { DEMO_CODE, PrescriptionSharingPreviewStore } from './prescription-sharing.store';

describe('prescription sharing screens', () => {
  let fixture: ComponentFixture<PrescriptionSharing>;
  let page: PrescriptionSharing;
  let store: PrescriptionSharingPreviewStore;
  async function create(audience: 'Patient' | 'Pharmacist' = 'Patient') {
    store = new PrescriptionSharingPreviewStore();
    TestBed.configureTestingModule({
      imports: [PrescriptionSharing],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { audience: audience.toLowerCase() } } },
        },
      ],
    });
    TestBed.overrideComponent(PrescriptionSharing, {
      set: { providers: [{ provide: PRESCRIPTION_SHARING, useValue: store }] },
    });
    const role = TestBed.inject(ActiveRoleService);
    role.setAccountRoles('sample-account', [audience.toLowerCase()]);
    fixture = TestBed.createComponent(PrescriptionSharing);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const text = () => fixture.nativeElement.textContent as string;
  const input = (value: string) => ({ target: { value } }) as unknown as Event;
  afterEach(() => fixture?.destroy());
  it('labels samples, eligible records and all lifecycle states', async () => {
    await create();
    expect(text()).toContain('Sample data only');
    expect(text()).toContain('Awaiting patient confirmation');
    expect(text()).toContain('Access confirmed');
    expect(text()).toContain('Expired');
    expect(text()).toContain('Revoked');
    expect(fixture.nativeElement.querySelector('option[value="demo-patient-order"]').disabled).toBe(
      true,
    );
    expect(fixture.nativeElement.querySelector('option[value="demo-draft"]').disabled).toBe(true);
  });
  it('validates selection before creating', async () => {
    await create();
    const spy = vi.spyOn(store, 'create');
    await page.create();
    fixture.detectChanges();
    expect(spy).not.toHaveBeenCalled();
    expect(text()).toContain('Choose an active doctor-issued');
  });
  it('shows code once in an accessible focus-trapped dialog and clears on Escape', async () => {
    await create();
    page.prescriptionId.set('demo-doctor-order');
    await page.create();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(2);
    expect(document.activeElement?.id).toBe('sharing-dialog-title');
    expect(dialog.querySelector('output').textContent).toContain('DEMO-132-1');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(page.code()).toBe('');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
  it('requires identity acknowledgement before confirmation', async () => {
    await create();
    const share = page.data().shares[0];
    const spy = vi.spyOn(store, 'confirm');
    page.open('confirm', share);
    await page.submit();
    expect(spy).not.toHaveBeenCalled();
    page.acknowledged.set(true);
    await page.submit();
    expect(spy).toHaveBeenCalledWith(share.id);
    expect(page.data().shares.find((s) => s.id === share.id)?.status).toBe('confirmed');
  });
  it('cancel leaves the grant unchanged', async () => {
    await create();
    page.open('revoke', page.data().shares[1]);
    page.reason.set('Cancel example');
    page.close();
    expect((await store.load()).shares[1].status).toBe('confirmed');
    expect(page.reason()).toBe('');
  });
  it('requires a trimmed revoke reason then ends access', async () => {
    await create();
    const share = page.data().shares[1];
    const spy = vi.spyOn(store, 'revoke');
    page.open('revoke', share);
    page.reason.set('  ');
    await page.submit();
    expect(spy).not.toHaveBeenCalled();
    page.reason.set('  No longer needed  ');
    await page.submit();
    expect(spy).toHaveBeenCalledWith(share.id, 'No longer needed');
    expect(page.data().shares.find((s) => s.id === share.id)?.status).toBe('revoked');
  });
  it('does not offer confirm/revoke for expired or revoked shares', async () => {
    await create();
    for (const share of page.data().shares.slice(2)) {
      expect(page.actionAllowed('confirm', share)).toBe(false);
      expect(page.actionAllowed('revoke', share)).toBe(false);
      page.open('confirm', share);
      expect(page.modal()).toBeNull();
    }
  });
  it('handles empty and retryable error scenarios', async () => {
    await create();
    page.changeScenario(input('empty'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('No shares to display');
    page.changeScenario(input('error'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('Sharing is unavailable');
    await page.load();
    fixture.detectChanges();
    expect(page.state()).toBe('ready');
    expect(page.data().shares.length).toBeGreaterThan(0);
  });
  it('filters by current status', async () => {
    await create();
    page.filter.set('claimed');
    fixture.detectChanges();
    expect(page.visibleShares()).toHaveLength(1);
  });
  it('clears code and session records on account switch', async () => {
    await create();
    page.prescriptionId.set('demo-doctor-order');
    await page.create();
    expect(page.code()).not.toBe('');
    TestBed.inject(ActiveRoleService).setAccountRoles('different-account', ['patient']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.code()).toBe('');
    expect(page.data().shares).toHaveLength(4);
    expect(page.modal()).toBeNull();
  });
  it('clears on role loss and denies further mutations', async () => {
    await create();
    page.prescriptionId.set('demo-doctor-order');
    await page.create();
    TestBed.inject(ActiveRoleService).clear();
    fixture.detectChanges();
    await fixture.whenStable();
    const spy = vi.spyOn(store, 'create');
    await page.create();
    expect(spy).not.toHaveBeenCalled();
    expect(page.code()).toBe('');
    expect(page.data().shares).toEqual([]);
  });
  it('discards late responses after navigation destroys the page', async () => {
    await create();
    let resolve!: (r: Awaited<ReturnType<typeof store.create>>) => void;
    vi.spyOn(store, 'create').mockImplementation(() => new Promise((r) => (resolve = r)));
    page.prescriptionId.set('demo-doctor-order');
    const pending = page.create();
    fixture.destroy();
    resolve({
      share: {
        id: 'late',
        prescriptionId: 'demo-doctor-order',
        prescriptionLabel: 'Late',
        status: 'created',
        createdAt: new Date().toISOString(),
        claimExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      claimToken: 'NEVER-SHOW',
    });
    await pending;
    expect(page.code()).toBe('');
    expect(page.modal()).toBeNull();
  });
  it('prevents double submission while a mutation is pending', async () => {
    await create();
    const original = store.create.bind(store);
    let resolve!: () => void;
    const spy = vi.spyOn(store, 'create').mockImplementation(async (id) => {
      await new Promise<void>((r) => (resolve = r));
      return original(id);
    });
    page.prescriptionId.set('demo-doctor-order');
    const first = page.create();
    await page.create();
    expect(spy).toHaveBeenCalledTimes(1);
    resolve();
    await first;
  });
  it('shows safe mutation errors without exception or token content', async () => {
    await create();
    vi.spyOn(store, 'create').mockRejectedValue(new Error('SECRET server details'));
    page.prescriptionId.set('demo-doctor-order');
    await page.create();
    fixture.detectChanges();
    expect(text()).toContain('Unable to create');
    expect(text()).not.toContain('SECRET');
    expect(page.busy()).toBe(false);
  });
  it('starts the pharmacist screen empty and validates required fields', async () => {
    await create('Pharmacist');
    expect(page.data().shares).toEqual([]);
    expect(text()).not.toContain('A. Perera');
    const spy = vi.spyOn(store, 'claim');
    await page.claim();
    expect(spy).not.toHaveBeenCalled();
    expect(page.error()).toContain('Enter a code');
  });
  it('claims with selected pharmacy, clears raw token, and waits for confirmation without medicines', async () => {
    await create('Pharmacist');
    page.tokenInput.set(DEMO_CODE);
    page.organizationId.set('demo-pharmacy');
    await page.claim();
    fixture.detectChanges();
    expect(page.tokenInput()).toBe('');
    expect(page.data().shares[0].status).toBe('claimed');
    expect(text()).toContain('Waiting for the patient');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.querySelector('button.danger')).toBeNull();
  });
  it('clears a failed claim token and gives safe recovery guidance', async () => {
    await create('Pharmacist');
    page.tokenInput.set('INVALID-PRIVATE-CODE');
    page.organizationId.set('demo-pharmacy');
    await page.claim();
    fixture.detectChanges();
    expect(page.tokenInput()).toBe('');
    expect(page.error()).toContain('already claimed');
    expect(text()).not.toContain('INVALID-PRIVATE-CODE');
  });
  it.each(['confirmed', 'expired', 'revoked'])(
    'shows pharmacist sample %s outcome without medicines',
    async (scenario) => {
      await create('Pharmacist');
      page.changeScenario(input(scenario));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(page.visibleShares()).toHaveLength(1);
      expect(page.status(page.visibleShares()[0])).toBe(scenario);
      expect(text()).toContain('No medicines or other patient records');
    },
  );
  it('returns focus to the initiating button after clearing the code', async () => {
    await create();
    page.prescriptionId.set('demo-doctor-order');
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Create sample code'),
    ) as HTMLButtonElement;
    button.focus();
    await page.create({ currentTarget: button } as unknown as Event);
    fixture.detectChanges();
    await fixture.whenStable();
    page.close();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button);
    expect(page.code()).toBe('');
  });
  it('focuses the validation alert after an invalid create attempt', async () => {
    await create();
    await page.create();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
  });
  it('clears a visible code at its deadline', async () => {
    await create();
    page.prescriptionId.set('demo-doctor-order');
    await page.create();
    const deadline = Date.parse(page.selected()!.claimExpiresAt);
    vi.spyOn(Date, 'now').mockReturnValue(deadline);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    fixture.detectChanges();
    expect(page.modal()).toBeNull();
    expect(page.code()).toBe('');
    vi.restoreAllMocks();
  });
});
