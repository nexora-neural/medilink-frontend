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

  openSuggestions(): void {
    if (this.state() !== 'ready') return;
    this.activeIndex.set(-1);
    this.showSuggestions.set(true);
  }

  closeSuggestions(): void {
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      this.closeSuggestions();
      return;
    }
    if (this.state() !== 'ready') return;

    const results = this.filteredMedicines();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const wasOpen = this.showSuggestions();
      this.showSuggestions.set(true);
      if (results.length > 0) {
        const index = wasOpen ? this.activeIndex() : -1;
        this.activeIndex.set(
          event.key === 'ArrowDown'
            ? (index + 1) % results.length
            : index <= 0
              ? results.length - 1
              : index - 1,
        );
      }
      return;
    }

    if (event.key === 'Enter' && this.showSuggestions()) {
      const index = this.activeIndex();
      const medicine = index >= 0 ? results[index] : results.length === 1 ? results[0] : null;
      if (medicine) {
        event.preventDefault();
        this.selectMedicine(medicine);
      }
    }
  }

  setPreviewState(state: MedicineState): void {
    this.state.set(state);
    this.selectedMedicine.set(null);
    this.closeSuggestions();
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
