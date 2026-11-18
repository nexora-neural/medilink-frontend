import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import { PatientLabRequests } from './patient-lab-requests';

describe('PatientLabRequests preview', () => {
  async function setup(preview = '') {
    const activeRole = signal<ActiveRole>('Patient');

    await TestBed.configureTestingModule({
      imports: [PatientLabRequests],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(preview ? { preview } : {})),
          },
        },
        {
          provide: ActiveRoleService,
          useValue: { activeRole: activeRole.asReadonly() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PatientLabRequests);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      activeRole,
    };
  }

  it('shows active, expired and revoked sample requests', async () => {
    const { page, fixture } = await setup();

    expect(page.visibleRequests()).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('Sample preview only');
    expect(fixture.nativeElement.textContent).toContain('Expired');
    expect(fixture.nativeElement.textContent).toContain('Revoked');

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.request-card'),
    ) as HTMLElement[];

    for (const card of cards) {
      const status = card.querySelector('.status-badge')?.textContent?.trim();
      expect(card.querySelector('button') !== null).toBe(status === 'Active');
    }
  });

  it('requires an approved sample laboratory', async () => {
    const { page } = await setup();

    page.createRequest();

    expect(page.requests()).toHaveLength(4);
    expect(page.error()).toContain('Select an approved');

    page.labControl.setValue('unknown-lab');
    page.createRequest();

    expect(page.requests()).toHaveLength(4);
    expect(page.error()).toContain('Select an approved');
  });

  it('creates a request with a seven-day lifetime', async () => {
    const { page } = await setup();

    page.labControl.setValue(page.labs[0].id);
    page.createRequest();

    const request = page.requests()[0];

    expect(page.visibleRequests()).toHaveLength(5);
    expect(request.labId).toBe(page.labs[0].id);
    expect(request.reference).toMatch(/^sample_[a-f0-9]{32}$/);
    expect(Date.parse(request.expiresAt) - Date.parse(request.createdAt)).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    expect(page.status(request)).toBe('active');
  });

  it('creates only one request from an empty preview', async () => {
    const { page } = await setup('empty');

    expect(page.visibleRequests()).toHaveLength(0);

    page.labControl.setValue(page.labs[0].id);
    page.createRequest();

    expect(page.requests()).toHaveLength(1);
    expect(page.visibleRequests()).toHaveLength(1);
  });

  it('keeps a request active when revocation is cancelled', async () => {
    const { page } = await setup();
    const request = page.visibleRequests().find((item) => page.status(item) === 'active')!;

    page.requestRevoke(request);
    expect(page.selectedRevoke()?.id).toBe(request.id);

    page.cancelRevoke();

    expect(page.pendingRevoke()).toBeNull();
    expect(page.status(request)).toBe('active');
  });

  it('revokes only the confirmed request', async () => {
    const { page } = await setup();
    const request = page.visibleRequests().find((item) => page.status(item) === 'active')!;
    const others = page.requests().filter((item) => item.id !== request.id);

    page.requestRevoke(request);
    page.confirmRevoke();

    const updated = page.requests().find((item) => item.id === request.id)!;

    expect(page.status(updated)).toBe('revoked');
    expect(updated.revokedAt).not.toBeNull();
    expect(page.pendingRevoke()).toBeNull();
    expect(page.requests().filter((item) => item.id !== request.id)).toEqual(others);
  });

  it('does not offer confirmation for expired or revoked requests', async () => {
    const { page } = await setup();

    for (const request of page.visibleRequests()) {
      if (page.status(request) !== 'active') {
        page.requestRevoke(request);
        expect(page.pendingRevoke()).toBeNull();
      }
    }
  });

  it('rechecks expiry before confirming revocation', async () => {
    const { page } = await setup();
    const request = page.visibleRequests().find((item) => page.status(item) === 'active')!;

    page.requestRevoke(request);
    page.requests.update((items) =>
      items.map((item) =>
        item.id === request.id
          ? { ...item, expiresAt: new Date(Date.now() - 1000).toISOString() }
          : item,
      ),
    );

    page.confirmRevoke();

    const updated = page.requests().find((item) => item.id === request.id)!;
    expect(updated.revokedAt).toBeNull();
    expect(page.error()).toContain('no longer active');
  });

  for (const state of ['loading', 'error', 'denied']) {
    it(`hides requests and blocks creation in ${state}`, async () => {
      const { page, fixture } = await setup(state);

      page.labControl.setValue(page.labs[0].id);
      page.createRequest();
      fixture.detectChanges();

      expect(page.requests()).toHaveLength(4);
      expect(page.visibleRequests()).toHaveLength(0);
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      expect(fixture.nativeElement.querySelector('.request-card')).toBeNull();
    });
  }

  it('restores the workspace after retry', async () => {
    const { page } = await setup('error');

    page.retry();

    expect(page.pageState()).toBe('ready');
    expect(page.visibleRequests()).toHaveLength(4);
  });

  it('blocks changes after the active role changes', async () => {
    const { page, activeRole } = await setup();
    const original = page.requests().map((item) => ({ ...item }));
    const request = page.visibleRequests().find((item) => page.status(item) === 'active')!;

    page.requestRevoke(request);
    page.labControl.setValue(page.labs[0].id);
    activeRole.set('Lab Staff');

    page.confirmRevoke();
    page.createRequest();

    expect(page.requests()).toEqual(original);
    expect(page.visibleRequests()).toHaveLength(0);
  });
  it('does not restore pending revocation when switching back to Patient', async () => {
    const { page, fixture, activeRole } = await setup();

    const request = page.visibleRequests().find((item) => page.status(item) === 'active')!;

    page.requestRevoke(request);
    fixture.detectChanges();

    expect(page.selectedRevoke()?.id).toBe(request.id);

    activeRole.set('Lab Staff');
    fixture.detectChanges();

    expect(page.pendingRevoke()).toBeNull();
    expect(page.selectedRevoke()).toBeNull();

    activeRole.set('Patient');
    fixture.detectChanges();

    expect(page.pendingRevoke()).toBeNull();
    expect(page.selectedRevoke()).toBeNull();

    const unchanged = page.requests().find((item) => item.id === request.id)!;
    expect(unchanged.revokedAt).toBeNull();
    expect(page.status(unchanged)).toBe('active');
  });
});
