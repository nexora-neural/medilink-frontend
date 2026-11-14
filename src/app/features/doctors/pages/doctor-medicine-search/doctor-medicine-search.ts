import { Component, computed, signal } from '@angular/core';

type MedicineState = 'ready' | 'loading' | 'empty' | 'error';

interface Medicine {
  id: string;
  genericName: string;
  brand: string;
  strength: string;
  form: string;
  category: string;
  description: string;
}

const SAMPLE_MEDICINES: Medicine[] = [
  {
    id: 'MED-001',
    genericName: 'Paracetamol',
    brand: 'Panadol',
    strength: '500 mg',
    form: 'Tablet',
    category: 'Pain relief',
    description: 'Used for temporary relief of pain and fever.',
  },
  {
    id: 'MED-002',
    genericName: 'Amoxicillin',
    brand: 'Amoxil',
    strength: '500 mg',
    form: 'Capsule',
    category: 'Antibiotic',
    description: 'Prescription antibiotic medicine.',
  },
  {
    id: 'MED-003',
    genericName: 'Cetirizine',
    brand: 'Zyrtec',
    strength: '10 mg',
    form: 'Tablet',
    category: 'Antihistamine',
    description: 'Used to relieve allergy symptoms.',
  },
  {
    id: 'MED-004',
    genericName: 'Metformin',
    brand: 'Glucophage',
    strength: '500 mg',
    form: 'Tablet',
    category: 'Antidiabetic',
    description: 'Prescription medicine used to manage blood glucose.',
  },
  {
    id: 'MED-005',
    genericName: 'Omeprazole',
    brand: 'Losec',
    strength: '20 mg',
    form: 'Capsule',
    category: 'Gastrointestinal',
    description: 'Reduces stomach acid production.',
  },
  {
    id: 'MED-006',
    genericName: 'Salbutamol',
    brand: 'Ventolin',
    strength: '100 mcg',
    form: 'Inhaler',
    category: 'Respiratory',
    description: 'A bronchodilator used for breathing difficulties.',
  },
];

@Component({
  selector: 'app-doctor-medicine-search',
  standalone: true,
  templateUrl: './doctor-medicine-search.html',
  styleUrl: './doctor-medicine-search.scss',
})
export class DoctorMedicineSearch {
  readonly searchTerm = signal('');
  readonly selectedMedicine = signal<Medicine | null>(null);
  readonly state = signal<MedicineState>('ready');
  readonly activeIndex = signal(-1);
  readonly showSuggestions = signal(false);

  readonly medicines = signal<Medicine[]>(SAMPLE_MEDICINES);

  readonly filteredMedicines = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    if (!query) {
      return this.medicines();
    }

    return this.medicines().filter((medicine) =>
      [
        medicine.genericName,
        medicine.brand,
        medicine.strength,
        medicine.form,
        medicine.category,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  });

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.selectedMedicine.set(null);
    this.activeIndex.set(-1);
    this.showSuggestions.set(true);

    if (this.state() === 'error' || this.state() === 'empty') {
      this.state.set('ready');
    }
  }

  selectMedicine(medicine: Medicine): void {
    this.selectedMedicine.set(medicine);
    this.searchTerm.set(medicine.genericName);
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.filteredMedicines();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showSuggestions.set(true);

      if (results.length > 0) {
        this.activeIndex.update((index) => (index >= results.length - 1 ? 0 : index + 1));
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (results.length > 0) {
        this.activeIndex.update((index) => (index <= 0 ? results.length - 1 : index - 1));
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const index = this.activeIndex();
      if (index >= 0 && results[index]) {
        this.selectMedicine(results[index]);
      } else if (results.length === 1) {
        this.selectMedicine(results[0]);
      }
    }

    if (event.key === 'Escape') {
      this.showSuggestions.set(false);
      this.activeIndex.set(-1);
    }
  }

  setPreviewState(state: MedicineState): void {
    this.state.set(state);
    this.selectedMedicine.set(null);
    this.showSuggestions.set(false);
  }

  retry(): void {
    this.state.set('ready');
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.selectedMedicine.set(null);
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
    this.state.set('ready');
  }
}
