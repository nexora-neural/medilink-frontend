import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveRoleService } from '../../../core/context/active-role.service';
import { PrescriptionPdfExport } from './prescription-pdf-export';
import { PRESCRIPTION_ROUTES } from '../prescription.routes';

@Component({ standalone: true, template: '<h1>Access denied</h1>' })
class AccessDeniedStub {}

describe('doctor prescription PDF export routing', () => {
  let harness: RouterTestingHarness;
  let roles: ActiveRoleService;
  const base = '/workspace/doctor/prescriptions';

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  afterEach(() => vi.restoreAllMocks());

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'workspace/doctor/prescriptions', children: PRESCRIPTION_ROUTES },
          { path: 'access-denied', component: AccessDeniedStub },
        ]),
      ],
    });

    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('sample-account', ['doctor', 'patient']);
    roles.setActiveRole('Doctor');
    harness = await RouterTestingHarness.create();
  });

  it('shows a current doctor-issued prescription with all export metadata and item fields', async () => {
    await harness.navigateByUrl(`${base}/sample-replacement-01/export`, PrescriptionPdfExport);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(text()).toContain('PDF preview');
    expect(text()).toContain('SourceDoctor-issued');
    expect(text()).toContain('IssuerDr. Maya Perera');
    expect(text()).toContain('Issuer verificationVerified doctor · synthetic preview');
    expect(text()).toContain('Review statusIssued after review · synthetic preview');
    expect(text()).toContain('Current version2');
    expect(text()).toContain('Lifecycle statusactive');
    expect(text()).toContain('Sample medicine C');
    expect(text()).toContain('DoseSample dose C');
    expect(text()).toContain('InstructionsSynthetic corrected instructions for version preview.');
    expect(
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.download-button')!.disabled,
    ).toBe(false);
  });

  it('shows empty, loading, denied and validation states', async () => {
    await harness.navigateByUrl(`${base}/missing-record/export`, PrescriptionPdfExport);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(text()).toContain('Prescription not found');

    await harness.navigateByUrl(
      `${base}/sample-replacement-01/export?preview=loading`,
      PrescriptionPdfExport,
    );
    expect(text()).toContain('Loading prescription');

    await harness.navigateByUrl(
      `${base}/sample-replacement-01/export?preview=denied`,
      PrescriptionPdfExport,
    );
    expect(text()).toContain('Export access unavailable');
    expect(text()).not.toContain('Sample patient B');

    await harness.navigateByUrl(
      `${base}/sample-replacement-01/export?preview=validation`,
      PrescriptionPdfExport,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(text()).toContain('This prescription cannot be exported');
    expect(text()).toContain('Medicine 1 is incomplete and cannot be exported.');
    expect(
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.download-button')!.disabled,
    ).toBe(true);
  });

  it('shows a retriable error when prescription data cannot be loaded', async () => {
    await harness.navigateByUrl(
      `${base}/sample-replacement-01/export?preview=error`,
      PrescriptionPdfExport,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(text()).toContain('Unable to load this prescription');

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe(`${base}/sample-replacement-01/export`);
    expect(text()).toContain('PDF preview');
  });

  it('shows a reload action when PDF generation fails', async () => {
    await harness.navigateByUrl(
      `${base}/sample-replacement-01/export?preview=download-error`,
      PrescriptionPdfExport,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.download-button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(text()).toContain('The sample PDF could not be prepared. Try again.');
    expect(text()).toContain('Reload current version');
  });

  it('downloads only the current synthetic PDF through a temporary object URL', async () => {
    await harness.navigateByUrl(`${base}/sample-replacement-01/export`, PrescriptionPdfExport);
    await harness.fixture.whenStable();
    harness.detectChanges();

    const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-pdf');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let downloadedFilename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.download-button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    expect(objectUrl).toHaveBeenCalledOnce();
    expect(downloadedFilename).toBe('prescription-sample-replacement-01-v2.pdf');
    expect(text()).toContain('Synthetic preview PDF downloaded for version 2');
    expect(revokeUrl).toHaveBeenCalledOnce();
  });

  it('redirects a non-doctor role before showing the prescription', async () => {
    roles.setActiveRole('Patient');
    await harness.navigateByUrl(`${base}/sample-replacement-01/export`, AccessDeniedStub);

    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(text()).toContain('Access denied');
    expect(text()).not.toContain('Sample patient B');
  });
});
