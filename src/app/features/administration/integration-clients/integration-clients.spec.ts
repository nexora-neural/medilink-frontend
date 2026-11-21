import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { IntegrationClients } from './integration-clients';
import { canAct, IntegrationClient, outcomeExplanation } from './integration-clients.models';
import {
  INTEGRATION_CLIENTS,
  IntegrationClientsPort,
  IntegrationClientsPreviewStore,
} from './integration-clients.store';

const future = () => new Date(Date.now() + 86400000).toISOString();
const active = (): IntegrationClient => ({
  id: 'client-1',
  name: 'Sample uploader',
  organizationId: 'lab-1',
  organizationName: 'Approved sample lab',
  status: 'active',
  scopes: ['reports:write'],
  expiresAt: future(),
});

describe('ML-107 integration-client screens', () => {
  let fixture: ComponentFixture<IntegrationClients>;
  let component: IntegrationClients;
  let roles: ActiveRoleService;
  let port: {
    [K in keyof IntegrationClientsPort]: ReturnType<typeof vi.fn<IntegrationClientsPort[K]>>;
  };

  async function setup(outcomes = false, role = 'super_admin') {
    port = {
      listClients: vi.fn().mockResolvedValue([active()]),
      listApprovedLabs: vi.fn().mockResolvedValue([{ id: 'lab-1', name: 'Approved sample lab' }]),
      listSubmissions: vi.fn().mockResolvedValue([
        {
          id: 'outcome-1',
          clientId: 'client-1',
          status: 'rejected',
          receivedAt: future(),
          errorCode: 'DUPLICATE_REPORT',
          patient_name: 'MUST-NOT-SHOW',
          request_token: 'SECRET-TOKEN',
          credential: 'SECRET-KEY',
        },
      ]),
      approve: vi.fn().mockImplementation(async (input) => ({
        client: { ...active(), name: input.name },
        credential: 'ONE-TIME-DEMO',
      })),
      change: vi
        .fn()
        .mockImplementation(async (_id, action) =>
          action === 'rotate'
            ? { client: active(), credential: 'ROTATED-DEMO' }
            : { ...active(), status: action === 'suspend' ? 'suspended' : 'revoked' },
        ),
    };
    await TestBed.configureTestingModule({
      imports: [IntegrationClients],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { view: outcomes ? 'outcomes' : 'clients' } } },
        },
      ],
    })
      .overrideComponent(IntegrationClients, {
        set: { providers: [{ provide: INTEGRATION_CLIENTS, useValue: port }] },
      })
      .compileComponents();
    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('test-user', [role]);
    fixture = TestBed.createComponent(IntegrationClients);
    component = fixture.componentInstance;
    fixture.detectChanges();
    if (role === 'super_admin') await vi.waitFor(() => expect(component.state()).toBe('ready'));
    fixture.detectChanges();
  }

  const text = () => fixture.nativeElement.textContent as string;
  function approval() {
    component.open('approve');
    fixture.detectChanges();
    component.form.patchValue({
      organizationId: 'lab-1',
      name: '  New uploader  ',
      expiresAt: future(),
    });
  }

  it('shows clients, narrow scope, expiry and connected navigation', async () => {
    await setup();
    expect(text()).not.toContain('Sample preview.');
    expect(text()).toContain('Sample uploader');
    expect(text()).toContain('reports:write');
    expect(
      fixture.nativeElement.querySelector('a[href="/super-admin/integrations/submissions"]'),
    ).not.toBeNull();
  });

  it('filters by text and lifecycle status and shows an empty state', async () => {
    await setup();
    component.query.set('no match');
    fixture.detectChanges();
    expect(text()).toContain('No integration clients');
    component.query.set('Approved sample lab');
    expect(component.filtered()).toHaveLength(1);
    component.filter.set('suspended');
    expect(component.filtered()).toHaveLength(0);
  });

  it('renders loading and failure states and allows retry', async () => {
    await setup();
    let resolve!: (items: IntegrationClient[]) => void;
    port.listClients.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const load = component.load();
    fixture.detectChanges();
    expect(text()).toContain('Loading integrations');
    resolve([]);
    await load;
    fixture.detectChanges();
    expect(text()).toContain('No integration clients');
    port.listClients.mockRejectedValueOnce(new Error('private backend trace'));
    await component.load();
    fixture.detectChanges();
    expect(text()).toContain('Unable to load integrations');
    expect(text()).not.toContain('private backend trace');
    await component.load();
    expect(component.state()).toBe('ready');
  });

  it('requires name, approved organization and future expiry', async () => {
    await setup();
    component.open('approve');
    fixture.detectChanges();
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
    component.form.patchValue({ name: '   ', organizationId: 'lab-1', expiresAt: future() });
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
    component.form.patchValue({ name: 'Uploader', organizationId: 'unapproved' });
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
    component.form.patchValue({ organizationId: 'lab-1', expiresAt: '2020-01-01T00:00' });
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
    component.form.patchValue({ expiresAt: 'invalid' });
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
  });

  it('blocks overlong client names', async () => {
    await setup();
    approval();
    component.form.controls.name.setValue('x'.repeat(201));
    await component.confirm();
    expect(port.approve).not.toHaveBeenCalled();
  });

  it('disables approval when no approved labs exist', async () => {
    await setup();
    component.labs.set([]);
    component.open('approve');
    fixture.detectChanges();
    expect(text()).toContain('No approved laboratories');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('creates only reports:write and clears the one-time credential on close', async () => {
    await setup();
    approval();
    await component.confirm();
    fixture.detectChanges();
    expect(port.approve).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New uploader', scopes: ['reports:write'] }),
    );
    expect(fixture.nativeElement.querySelector('#one-time-credential').value).toBe('ONE-TIME-DEMO');
    expect(JSON.stringify(component.clients())).not.toContain('ONE-TIME-DEMO');
    component.close();
    fixture.detectChanges();
    expect(component.credential()).toBeNull();
    expect(fixture.nativeElement.querySelector('#one-time-credential')).toBeNull();
    component.open('rotate', component.clients()[0]);
    expect(component.credential()).toBeNull();
  });

  it('cancels an action without making a mutation', async () => {
    await setup();
    component.open('revoke', active());
    component.close();
    await component.confirm();
    expect(port.change).not.toHaveBeenCalled();
  });

  for (const action of ['suspend', 'revoke', 'rotate'] as const) {
    it(`requires a reason before ${action}`, async () => {
      await setup();
      component.open(action, active());
      fixture.detectChanges();
      component.form.patchValue({ reason: '   ', expiresAt: future() });
      await component.confirm();
      expect(port.change).not.toHaveBeenCalled();
      component.form.controls.reason.setValue('x'.repeat(1001));
      await component.confirm();
      expect(port.change).not.toHaveBeenCalled();
    });
  }

  it('confirms suspend and revoke separately and removes active-only actions', async () => {
    await setup();
    component.open('suspend', active());
    fixture.detectChanges();
    component.form.controls.reason.setValue('  Planned maintenance  ');
    await component.confirm();
    expect(port.change).toHaveBeenLastCalledWith(
      'client-1',
      'suspend',
      'Planned maintenance',
      undefined,
    );
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Rotate credential for Sample uploader"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Suspend Sample uploader"]'),
    ).toBeNull();
    component.open('revoke', component.clients()[0]);
    fixture.detectChanges();
    component.form.controls.reason.setValue('Retired');
    await component.confirm();
    fixture.detectChanges();
    expect(text()).toContain('Access revoked');
  });

  it('requires future expiry for rotation and shows the replacement once', async () => {
    await setup();
    component.open('rotate', active());
    fixture.detectChanges();
    component.form.controls.reason.setValue('Scheduled rotation');
    await component.confirm();
    expect(port.change).not.toHaveBeenCalled();
    component.form.controls.expiresAt.setValue(future());
    await component.confirm();
    fixture.detectChanges();
    expect(component.modal()).toBe('credential');
    expect(component.credential()).toBe('ROTATED-DEMO');
  });

  it('blocks duplicate submissions and modal dismissal while saving', async () => {
    await setup();
    approval();
    let resolve!: (value: { client: IntegrationClient; credential: string }) => void;
    port.approve.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const save = component.confirm();
    await component.confirm();
    component.close();
    expect(port.approve).toHaveBeenCalledTimes(1);
    expect(component.modal()).toBe('approve');
    resolve({ client: active(), credential: 'ONE-TIME-DEMO' });
    await save;
  });

  it('shows safe mutation failure without claiming success', async () => {
    await setup();
    approval();
    port.approve.mockRejectedValueOnce(new Error('private stack trace'));
    await component.confirm();
    fixture.detectChanges();
    expect(text()).toContain('Could not confirm the change');
    expect(text()).not.toContain('private stack trace');
    expect(component.message()).toBe('');
    expect(component.credential()).toBeNull();
  });

  it('blocks stale lifecycle actions', async () => {
    await setup();
    component.open('rotate', active());
    fixture.detectChanges();
    component.form.patchValue({ reason: 'Rotation', expiresAt: future() });
    component.clients.set([{ ...active(), status: 'revoked' }]);
    await component.confirm();
    expect(port.change).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('status has changed');
  });

  it('blocks delegated admins even when the component is created directly', async () => {
    await setup(false, 'admin');
    component.open('approve');
    await component.confirm();
    expect(text()).toContain('Access restricted');
    expect(port.listClients).not.toHaveBeenCalled();
    expect(port.approve).not.toHaveBeenCalled();
  });

  it('clears a visible credential when permission is lost', async () => {
    await setup();
    approval();
    await component.confirm();
    fixture.detectChanges();
    roles.clear();
    fixture.detectChanges();
    expect(component.credential()).toBeNull();
    expect(component.modal()).toBeNull();
    expect(component.clients()).toEqual([]);
  });

  it('discards an in-flight credential if permission is lost', async () => {
    await setup();
    approval();
    let resolve!: (value: { client: IntegrationClient; credential: string }) => void;
    port.approve.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const save = component.confirm();
    roles.clear();
    fixture.detectChanges();
    resolve({ client: active(), credential: 'MUST-NOT-SHOW' });
    await save;
    expect(component.credential()).toBeNull();
    expect(component.modal()).toBeNull();
  });

  it('discards an in-flight credential when navigating away', async () => {
    await setup();
    approval();
    let resolve!: (value: { client: IntegrationClient; credential: string }) => void;
    port.approve.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const save = component.confirm();
    fixture.destroy();
    resolve({ client: active(), credential: 'MUST-NOT-SHOW' });
    await save;
    expect(component.credential()).toBeNull();
  });

  it('supports Escape and restores focus to the invoking control', async () => {
    await setup();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.page-heading button');
    button.focus();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.contains(document.activeElement)).toBe(true);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.modal()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('renders sanitized outcomes without arbitrary backend fields or raw error text', async () => {
    await setup(true);
    expect(text()).toContain('Duplicate submission rejected.');
    expect(text()).not.toMatch(/MUST-NOT-SHOW|SECRET-TOKEN|SECRET-KEY/);
    expect(outcomeExplanation('raw exception with clinical content')).toBe(
      'Submission could not be completed.',
    );
    component.outcomeFilter.set('accepted');
    fixture.detectChanges();
    expect(text()).toContain('No submission outcomes');
  });

  it('allows only valid lifecycle operations, including expiry', () => {
    for (const status of ['pending', 'suspended', 'revoked', 'expired'] as const) {
      expect(canAct({ ...active(), status }, 'rotate')).toBe(false);
      expect(canAct({ ...active(), status }, 'suspend')).toBe(false);
    }
    expect(canAct({ ...active(), status: 'revoked' }, 'revoke')).toBe(false);
    expect(canAct({ ...active(), expiresAt: '2020-01-01T00:00:00Z' }, 'rotate')).toBe(false);
  });
});

describe('ML-107 sample store boundary', () => {
  it('never puts credentials or hashes in client lists and denies illegal actions', async () => {
    const store = new IntegrationClientsPreviewStore();
    const result = await store.approve({
      organizationId: 'sample-lab',
      name: 'Test',
      scopes: ['reports:write'],
      expiresAt: future(),
    });
    expect(result.credential).toContain('DEMO-ONLY');
    expect(JSON.stringify(await store.listClients())).not.toMatch(/credential|DEMO-ONLY|hash/);
    await store.change(result.client.id, 'suspend', 'Maintenance');
    await expect(store.change(result.client.id, 'rotate', 'Try', future())).rejects.toThrow();
    await store.change(result.client.id, 'revoke', 'Retired');
    await expect(store.change(result.client.id, 'revoke', 'Again')).rejects.toThrow();
  });
});
