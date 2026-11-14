import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DoctorMedicineSearch } from './doctor-medicine-search';

describe('DoctorMedicineSearch', () => {
  let component: DoctorMedicineSearch;
  let fixture: ComponentFixture<DoctorMedicineSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorMedicineSearch],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorMedicineSearch);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads the sample medicine catalogue', () => {
    expect(component.medicines().length).toBe(6);
    expect(component.filteredMedicines().length).toBe(6);
  });

  it('filters medicines using the generic name', () => {
    component.onSearch('Paracetamol');

    expect(component.filteredMedicines().length).toBe(1);
    expect(component.filteredMedicines()[0].genericName).toBe('Paracetamol');
  });

  it('filters medicines using the brand name', () => {
    component.onSearch('Panadol');

    expect(component.filteredMedicines().length).toBe(1);
    expect(component.filteredMedicines()[0].brand).toBe('Panadol');
  });

  it('filters medicines using strength and dosage form', () => {
    component.onSearch('100 mcg');

    expect(component.filteredMedicines().length).toBe(1);
    expect(component.filteredMedicines()[0].strength).toBe('100 mcg');

    component.onSearch('Capsule');

    expect(component.filteredMedicines().length).toBe(2);
  });

  it('performs case-insensitive search', () => {
    component.onSearch('panadol');

    expect(component.filteredMedicines().length).toBe(1);
    expect(component.filteredMedicines()[0].brand).toBe('Panadol');
  });

  it('returns all medicines when the search is empty', () => {
    component.onSearch('Panadol');
    component.onSearch('');

    expect(component.filteredMedicines().length).toBe(6);
  });

  it('shows an empty result when no medicine matches', () => {
    component.onSearch('UnknownMedicine');

    expect(component.filteredMedicines()).toEqual([]);
  });

  it('selects a medicine and updates the search field', () => {
    const medicine = component.medicines()[0];

    component.selectMedicine(medicine);

    expect(component.selectedMedicine()).toEqual(medicine);
    expect(component.searchTerm()).toBe('Paracetamol');
    expect(component.showSuggestions()).toBe(false);
    expect(component.activeIndex()).toBe(-1);
  });

  it('opens suggestions and moves down using ArrowDown', () => {
    component.onSearch('a');

    const event = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    component.onSearchKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.showSuggestions()).toBe(true);
    expect(component.activeIndex()).toBe(0);
  });

  it('moves through suggestions using ArrowUp and ArrowDown', () => {
    component.onSearch('a');

    component.onSearchKeydown({
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    component.onSearchKeydown({
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.activeIndex()).toBe(1);

    component.onSearchKeydown({
      key: 'ArrowUp',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.activeIndex()).toBe(0);
  });

  it('selects the active medicine using Enter', () => {
    component.onSearch('Paracetamol');

    component.onSearchKeydown({
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    component.onSearchKeydown({
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.selectedMedicine()?.genericName).toBe('Paracetamol');
    expect(component.showSuggestions()).toBe(false);
  });

  it('selects the only matching medicine when Enter is pressed', () => {
    component.onSearch('Panadol');

    component.onSearchKeydown({
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.selectedMedicine()?.brand).toBe('Panadol');
  });

  it('closes suggestions using Escape', () => {
    component.onSearch('Paracetamol');

    component.onSearchKeydown({
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    component.onSearchKeydown({
      key: 'Escape',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.showSuggestions()).toBe(false);
    expect(component.activeIndex()).toBe(-1);
  });

  it('changes the preview state', () => {
    component.setPreviewState('loading');

    expect(component.state()).toBe('loading');
    expect(component.selectedMedicine()).toBeNull();
    expect(component.showSuggestions()).toBe(false);
  });

  it('returns to ready state when retry is called', () => {
    component.setPreviewState('error');

    component.retry();

    expect(component.state()).toBe('ready');
  });

  it('resets the search and selected medicine when clearSearch is called', () => {
    component.onSearch('Panadol');
    component.selectMedicine(component.filteredMedicines()[0]);

    component.clearSearch();

    expect(component.searchTerm()).toBe('');
    expect(component.selectedMedicine()).toBeNull();
    expect(component.showSuggestions()).toBe(false);
    expect(component.activeIndex()).toBe(-1);
    expect(component.state()).toBe('ready');
  });
});
