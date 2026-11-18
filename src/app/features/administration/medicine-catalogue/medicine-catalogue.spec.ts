import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MedicineCatalogue } from './medicine-catalogue';
import { MedicineCatalogueApi, MedicinePage } from './medicine-catalogue-api.service';

const emptyPage: MedicinePage = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
};

const savedPage: MedicinePage = {
  ...emptyPage,
  total: 1,
  items: [
    {
      id: 'medicine-1',
      genericName: 'Paracetamol',
      brand: 'Panadol',
      strength: '500 mg',
      form: 'Tablet',
      isSample: true,
    },
  ],
};

describe('MedicineCatalogue', () => {
  let fixture: ComponentFixture<MedicineCatalogue>;
  let component: MedicineCatalogue;
  const listForManagement = vi.fn<MedicineCatalogueApi['listForManagement']>();
  const create = vi.fn<MedicineCatalogueApi['create']>();

  beforeEach(async () => {
    listForManagement.mockReset().mockResolvedValue(emptyPage);
    create.mockReset();

    await TestBed.configureTestingModule({
      imports: [MedicineCatalogue],
      providers: [
        {
          provide: MedicineCatalogueApi,
          useValue: { listForManagement, create },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicineCatalogue);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads saved sample entries on entry', async () => {
    listForManagement.mockResolvedValueOnce(savedPage);

    await render();

    expect(listForManagement).toHaveBeenCalledWith(1);
    expect(component.result()).toEqual(savedPage);
    expect(fixture.nativeElement.textContent).toContain('Sample data');
  });

  it('saves the separate fields and reloads page one', async () => {
    await render();
    listForManagement.mockResolvedValueOnce(savedPage);
    const payload = {
      generic_name: 'Paracetamol',
      brand_name: 'Panadol',
      strength: '500 mg',
      form: 'Tablet',
    };
    create.mockResolvedValueOnce({
      ...payload,
      id: 'medicine-1',
      is_sample: true,
    });
    component.form.setValue({
      genericName: ' Paracetamol ',
      brand: ' Panadol ',
      strength: ' 500 mg ',
      dosageForm: 'Tablet',
    });

    await component.addMedicine();

    expect(create).toHaveBeenCalledExactlyOnceWith(payload);
    expect(listForManagement).toHaveBeenCalledTimes(2);
    expect(listForManagement).toHaveBeenLastCalledWith(1);
    expect(component.result()?.items[0]?.id).toBe('medicine-1');
    expect(component.successMessage()).toContain('Medicine saved');
    expect(component.form.getRawValue().genericName).toBe('');
  });

  it('rejects a whitespace-only generic name', async () => {
    await render();
    component.form.controls.genericName.setValue('   ');

    await component.addMedicine();

    expect(component.form.controls.genericName.hasError('required')).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('retains the form when the service fails to save', async () => {
    await render();
    component.form.controls.genericName.setValue('Paracetamol');
    create.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await component.addMedicine();

    expect(component.form.getRawValue().genericName).toBe('Paracetamol');
    expect(component.saveError()).toContain('Could not confirm the save');
    expect(component.successMessage()).toBe('');
    expect(component.saving()).toBe(false);
    expect(listForManagement).toHaveBeenCalledTimes(1);
  });

  it('disables saving when management access is denied', async () => {
    listForManagement.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));

    await render();

    expect(component.denied()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});
