import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionApiService } from '../../services/prescription-api.service';
import { PrescriptionLiveDetail } from './prescription-live-detail';

describe('Prescription live detail', () => {
  const prescriptionId = '22222222-2222-4222-8222-222222222222';

  async function createErrorPage(status: number) {
    const get = vi.fn().mockRejectedValue(
      new HttpErrorResponse({
        status,
        statusText: 'Request failed',
      }),
    );

    TestBed.configureTestingModule({
      imports: [PrescriptionLiveDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: prescriptionId })),
          },
        },
        {
          provide: PrescriptionApiService,
          useValue: { get },
        },
      ],
    });

    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('test-doctor', ['doctor']);
    roles.setActiveRole('Doctor');

    const fixture = TestBed.createComponent(PrescriptionLiveDetail);
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, get };
  }

  it('shows unavailable when the prescription is not found', async () => {
    const { fixture, get } = await createErrorPage(404);

    expect(get).toHaveBeenCalledWith(prescriptionId);
    expect(fixture.nativeElement.textContent).toContain('Prescription unavailable');
    expect(fixture.componentInstance.detail()).toBeNull();
  });

  it('hides details when access is denied', async () => {
    const { fixture } = await createErrorPage(403);

    expect(fixture.nativeElement.textContent).toContain('Access unavailable');
    expect(fixture.componentInstance.detail()).toBeNull();
    expect(fixture.nativeElement.querySelector('.prescription-card')).toBeNull();
  });

  it('shows a retry button when the server fails', async () => {
    const { fixture, get } = await createErrorPage(500);

    expect(fixture.nativeElement.textContent).toContain('Unable to load prescription');

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.textContent).toContain('Try again');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(get).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.detail()).toBeNull();
  });
});
