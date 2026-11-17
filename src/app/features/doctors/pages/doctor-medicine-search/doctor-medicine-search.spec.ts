import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MedicineCatalogueApi,
  MedicinePage,
} from '../../../administration/medicine-catalogue/medicine-catalogue-api.service';
import { DoctorMedicineSearch } from './doctor-medicine-search';

const page: MedicinePage = {
  page: 1,
  pageSize: 20,
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

describe('DoctorMedicineSearch', () => {
  let fixture: ComponentFixture<DoctorMedicineSearch>;
  let component: DoctorMedicineSearch;
  const search = vi.fn<MedicineCatalogueApi['search']>();

  beforeEach(async () => {
    search.mockReset().mockResolvedValue(page);

    await TestBed.configureTestingModule({
      imports: [DoctorMedicineSearch],
      providers: [{ provide: MedicineCatalogueApi, useValue: { search } }],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorMedicineSearch);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function searchInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#medicine-search');
  }

  function press(key: string): void {
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  it('loads the first page from the API', () => {
    expect(search).toHaveBeenCalledExactlyOnceWith('', 1);
    expect(component.medicines()).toEqual(page.items);
    expect(component.total()).toBe(1);
  });

  it('sends the latest query and shows the empty state', async () => {
    search.mockResolvedValueOnce({ ...page, items: [], total: 0 });
    component.onSearch('Pan');
    component.onSearch('Unknown brand');

    await vi.waitFor(() => {
      expect(search).toHaveBeenCalledTimes(2);
      expect(search).toHaveBeenLastCalledWith('Unknown brand', 1);
      expect(component.state()).toBe('empty');
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No matching medicines');
  });

  it('shows denied access for a 403 response', async () => {
    search.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));

    await component.load();
    fixture.detectChanges();

    expect(component.state()).toBe('denied');
    expect(fixture.nativeElement.textContent).toContain('Catalogue access denied');
  });

  it('retries the failed page after a service error', async () => {
    search.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await component.load(2);
    fixture.detectChanges();

    expect(component.state()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Could not load medicines');

    search.mockResolvedValueOnce({ ...page, page: 2 });
    const retryButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('[role="alert"] button');
    retryButton.click();

    await vi.waitFor(() => {
      expect(search).toHaveBeenLastCalledWith('', 2);
      expect(component.state()).toBe('ready');
    });
  });

  it('selects an API result using the keyboard', () => {
    press('ArrowDown');

    expect(searchInput().getAttribute('aria-expanded')).toBe('true');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe('medicine-option-0');

    press('Enter');

    expect(component.selectedMedicine()).toEqual(page.items[0]);
    expect(searchInput().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.detail-eyebrow').textContent).toContain(
      'Sample data',
    );
  });

  it('closes the suggestions on Escape and keeps them closed on Enter', () => {
    press('ArrowDown');
    press('Escape');
    press('Enter');

    expect(searchInput().getAttribute('aria-expanded')).toBe('false');
    expect(component.selectedMedicine()).toBeNull();
  });

  it('selects a visible result with the pointer', () => {
    searchInput().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    const option: HTMLButtonElement = fixture.nativeElement.querySelector('[role="option"]');
    const mouseDown = new MouseEvent('mousedown', { cancelable: true });

    option.dispatchEvent(mouseDown);
    option.click();
    fixture.detectChanges();

    expect(mouseDown.defaultPrevented).toBe(true);
    expect(component.selectedMedicine()?.brand).toBe('Panadol');
    expect(searchInput().getAttribute('aria-expanded')).toBe('false');
  });
});
