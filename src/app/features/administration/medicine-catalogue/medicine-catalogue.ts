import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type CatalogueState = 'ready' | 'loading' | 'empty' | 'error';

interface CatalogueMedicine {
  id: string;
  genericName: string;
  brand: string;
  strength: string;
  form: string;
  category: string;
}

@Component({
  selector: 'app-medicine-catalogue',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './medicine-catalogue.html',
  styleUrl: './medicine-catalogue.scss',
})
export class MedicineCatalogue {
  private readonly fb = inject(FormBuilder);

  readonly state = signal<CatalogueState>('ready');
  readonly medicines = signal<CatalogueMedicine[]>([
    {
      id: 'MED-001',
      genericName: 'Paracetamol',
      brand: 'Panadol',
      strength: '500 mg',
      form: 'Tablet',
      category: 'Pain relief',
    },
    {
      id: 'MED-002',
      genericName: 'Amoxicillin',
      brand: 'Amoxil',
      strength: '500 mg',
      form: 'Capsule',
      category: 'Antibiotic',
    },
    {
      id: 'MED-003',
      genericName: 'Cetirizine',
      brand: 'Zyrtec',
      strength: '10 mg',
      form: 'Tablet',
      category: 'Antihistamine',
    },
  ]);

  readonly form = this.fb.nonNullable.group({
    genericName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    brand: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    strength: ['', [Validators.required, Validators.maxLength(50)]],
    dosageForm: ['', Validators.required],
    category: ['', Validators.required],
  });

  readonly totalMedicines = computed(() => this.medicines().length);

  readonly genericNameControl = this.form.controls.genericName;
  readonly brandControl = this.form.controls.brand;
  readonly strengthControl = this.form.controls.strength;
  readonly dosageFormControl = this.form.controls.dosageForm;
  readonly categoryControl = this.form.controls.category;

  submitted = signal(false);
  successMessage = signal('');

  addMedicine(): void {
    this.submitted.set(true);
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const newMedicine: CatalogueMedicine = {
      id: `MED-${String(Date.now()).slice(-6)}`,
      genericName: value.genericName.trim(),
      brand: value.brand.trim(),
      strength: value.strength.trim(),
      form: value.dosageForm,
      category: value.category,
    };

    this.medicines.update((items) => [newMedicine, ...items]);
    this.form.reset();
    this.submitted.set(false);
    this.successMessage.set('Medicine added to the sample catalogue.');
    this.state.set('ready');
  }

  setPreviewState(state: CatalogueState): void {
    this.state.set(state);
    this.successMessage.set('');
  }

  retry(): void {
    this.state.set('ready');
  }

  clearForm(): void {
    this.form.reset();
    this.submitted.set(false);
    this.successMessage.set('');
  }

  hasError(control: typeof this.genericNameControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }
}
