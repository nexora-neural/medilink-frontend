import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  CatalogueMedicine,
  isCatalogueAccessError,
  MedicineCatalogueApi,
} from '../../../administration/medicine-catalogue/medicine-catalogue-api.service';

type MedicineState = 'ready' | 'loading' | 'empty' | 'denied' | 'error';

@Component({
  selector: 'app-doctor-medicine-search',
  standalone: true,
  templateUrl: './doctor-medicine-search.html',
  styleUrl: './doctor-medicine-search.scss',
})
export class DoctorMedicineSearch implements OnInit, OnDestroy {
  private readonly api = inject(MedicineCatalogueApi);
  private timer?: ReturnType<typeof setTimeout>;
  private requestId = 0;
  private query = '';

  readonly searchTerm = signal('');
  readonly selectedMedicine = signal<CatalogueMedicine | null>(null);
  readonly state = signal<MedicineState>('loading');
  readonly activeIndex = signal(-1);
  readonly showSuggestions = signal(false);
  readonly medicines = signal<CatalogueMedicine[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.requestId++;
  }

  onSearch(value: string): void {
    clearTimeout(this.timer);
    this.requestId++;
    this.query = value;
    this.searchTerm.set(value);
    this.selectedMedicine.set(null);
    this.activeIndex.set(-1);
    this.showSuggestions.set(true);
    this.page.set(1);
    this.total.set(0);
    this.medicines.set([]);
    this.state.set('loading');
    this.timer = setTimeout(() => void this.load(), 250);
  }

  async load(page = this.page()): Promise<void> {
    clearTimeout(this.timer);
    const requestId = ++this.requestId;
    this.page.set(page);
    this.state.set('loading');
    this.activeIndex.set(-1);
    this.selectedMedicine.set(null);
    this.medicines.set([]);

    try {
      const result = await this.api.search(this.query, page);
      if (requestId !== this.requestId) return;

      this.medicines.set(result.items);
      this.total.set(result.total);
      this.page.set(result.page);
      this.pageSize.set(result.pageSize);
      this.state.set(result.items.length ? 'ready' : 'empty');
    } catch (error) {
      if (requestId !== this.requestId) return;

      this.total.set(0);
      this.state.set(isCatalogueAccessError(error) ? 'denied' : 'error');
    }
  }

  selectMedicine(medicine: CatalogueMedicine): void {
    this.selectedMedicine.set(medicine);
    this.closeSuggestions();
  }
  openSuggestions(): void {
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

    const results = this.medicines();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = this.showSuggestions() ? this.activeIndex() : -1;
      this.showSuggestions.set(true);
      if (event.key === 'ArrowDown') {
        this.activeIndex.set((index + 1) % results.length);
      } else {
        this.activeIndex.set(index <= 0 ? results.length - 1 : index - 1);
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

  retry(): void {
    void this.load();
  }

  clearSearch(): void {
    this.onSearch('');
    this.closeSuggestions();
  }
}
