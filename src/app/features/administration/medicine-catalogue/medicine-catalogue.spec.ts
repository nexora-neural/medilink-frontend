import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MedicineCatalogue } from './medicine-catalogue';

describe('MedicineCatalogue', () => {
  let component: MedicineCatalogue;
  let fixture: ComponentFixture<MedicineCatalogue>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicineCatalogue],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicineCatalogue);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads the initial sample medicines', () => {
    expect(component.medicines().length).toBe(3);
    expect(component.totalMedicines()).toBe(3);
  });

  it('marks the form invalid when required fields are empty', () => {
    component.addMedicine();

    expect(component.form.invalid).toBe(true);
    expect(component.submitted()).toBe(true);
    expect(component.totalMedicines()).toBe(3);
  });

  it('adds a medicine with valid form data', () => {
    component.form.setValue({
      genericName: 'Ibuprofen',
      brand: 'Brufen',
      strength: '400 mg',
      dosageForm: 'Tablet',
      category: 'Pain relief',
    });

    component.addMedicine();

    expect(component.totalMedicines()).toBe(4);
    expect(component.medicines()[0].genericName).toBe('Ibuprofen');
    expect(component.medicines()[0].brand).toBe('Brufen');
    expect(component.medicines()[0].strength).toBe('400 mg');
    expect(component.medicines()[0].form).toBe('Tablet');
    expect(component.medicines()[0].category).toBe('Pain relief');
  });

  it('trims whitespace from medicine text fields before saving', () => {
    component.form.setValue({
      genericName: '  Ibuprofen  ',
      brand: '  Brufen  ',
      strength: '  400 mg  ',
      dosageForm: 'Tablet',
      category: 'Pain relief',
    });

    component.addMedicine();

    expect(component.medicines()[0].genericName).toBe('Ibuprofen');
    expect(component.medicines()[0].brand).toBe('Brufen');
    expect(component.medicines()[0].strength).toBe('400 mg');
  });

  it('shows a success message after adding a medicine', () => {
    component.form.setValue({
      genericName: 'Ibuprofen',
      brand: 'Brufen',
      strength: '400 mg',
      dosageForm: 'Tablet',
      category: 'Pain relief',
    });

    component.addMedicine();

    expect(component.successMessage()).toBe('Medicine added to the sample catalogue.');
  });

  it('resets the form after successfully adding a medicine', () => {
    component.form.setValue({
      genericName: 'Ibuprofen',
      brand: 'Brufen',
      strength: '400 mg',
      dosageForm: 'Tablet',
      category: 'Pain relief',
    });

    component.addMedicine();

    expect(component.form.getRawValue()).toEqual({
      genericName: '',
      brand: '',
      strength: '',
      dosageForm: '',
      category: '',
    });
    expect(component.submitted()).toBe(false);
  });

  it('does not add a medicine when the form is invalid', () => {
    component.form.controls.genericName.setValue('A');

    component.addMedicine();

    expect(component.totalMedicines()).toBe(3);
    expect(component.form.invalid).toBe(true);
  });

  it('clears the form and success message', () => {
    component.form.controls.genericName.setValue('Ibuprofen');
    component.submitted.set(true);
    component.successMessage.set('Previous success message');

    component.clearForm();

    expect(component.form.getRawValue().genericName).toBe('');
    expect(component.submitted()).toBe(false);
    expect(component.successMessage()).toBe('');
  });

  it('changes the preview state', () => {
    component.setPreviewState('loading');

    expect(component.state()).toBe('loading');
    expect(component.successMessage()).toBe('');
  });

  it('returns to ready state when retry is called', () => {
    component.setPreviewState('error');

    component.retry();

    expect(component.state()).toBe('ready');
  });

  it('shows a validation error only after the control is touched or submitted', () => {
    const control = component.genericNameControl;

    expect(component.hasError(control)).toBe(false);

    control.markAsTouched();

    expect(component.hasError(control)).toBe(true);
  });
});
