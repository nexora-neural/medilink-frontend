import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionApiService } from '../../services/prescription-api.service';
import { PrescriptionLiveList } from './prescription-live-list';

describe('Prescription live list', () => {
  const patientId = '11111111-1111-4111-8111-111111111111';
  let list: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    list = vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });
  });

  function createPage(selectedPatientId?: string) {
    TestBed.configureTestingModule({
      imports: [PrescriptionLiveList],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap(selectedPatientId ? { patientId: selectedPatientId } : {}),
            ),
          },
        },
        {
          provide: PrescriptionApiService,
          useValue: { list },
        },
      ],
    });

    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('test-doctor', ['doctor']);
    roles.setActiveRole('Doctor');

    const fixture = TestBed.createComponent(PrescriptionLiveList);
    fixture.detectChanges();

    return fixture;
  }

  it('asks for a patient without requesting prescriptions', async () => {
    const fixture = createPage();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Select a patient');
    expect(list).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Sample patient');
  });

  it('requests the selected patient and shows an empty list', async () => {
    const fixture = createPage(patientId);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(list).toHaveBeenCalledWith(patientId, 1, 20);
    expect(fixture.nativeElement.textContent).toContain(
      'No prescriptions are available for this patient.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Sample patient');
  });

  it('shows denied access when the API returns 403', async () => {
    list.mockRejectedValue(
      new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
      }),
    );

    const fixture = createPage(patientId);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Access unavailable');
    expect(fixture.nativeElement.querySelector('.prescription-card')).toBeNull();
  });
});
