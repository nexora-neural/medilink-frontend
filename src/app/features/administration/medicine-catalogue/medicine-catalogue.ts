import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  isCatalogueAccessError,
  MedicineCatalogueApi,
  MedicinePage,
} from './medicine-catalogue-api.service';

@Component({
  selector: 'app-medicine-catalogue',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './medicine-catalogue.html',
  styleUrl: './medicine-catalogue.scss',
})
export class MedicineCatalogue implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MedicineCatalogueApi);
  private requestedPage = 1;

  readonly form = this.fb.nonNullable.group({
    genericName: ['', [Validators.required, Validators.maxLength(200)]],
    brand: ['', Validators.maxLength(200)],
    strength: ['', Validators.maxLength(100)],
    dosageForm: ['', Validators.maxLength(100)],
  });

  readonly result = signal<MedicinePage | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly denied = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly successMessage = signal('');

  ngOnInit(): void {
    void this.load();
  }

  async load(page = this.requestedPage): Promise<void> {
    if (this.loading()) return;

    this.requestedPage = page;
    this.loading.set(true);
    this.loadError.set('');
    this.denied.set(false);

    try {
      this.result.set(await this.api.listForManagement(page));
    } catch (error) {
      this.result.set(null);
      this.denied.set(isCatalogueAccessError(error));
      this.loadError.set(
        this.denied()
          ? 'You do not have access to manage the catalogue.'
          : 'Could not load the catalogue. Try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async addMedicine(): Promise<void> {
    if (this.saving() || this.loading() || this.denied()) return;

    this.saveError.set('');
    this.successMessage.set('');

    const { genericName, brand, strength, dosageForm } = this.form.getRawValue();
    this.form.patchValue({ genericName: genericName.trim() });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.form.disable();

    try {
      await this.api.create({
        generic_name: genericName.trim(),
        brand_name: brand.trim() || null,
        strength: strength.trim() || null,
        form: dosageForm.trim() || null,
      });
      this.form.reset();
      this.successMessage.set('Medicine saved to the sample catalogue.');
      await this.load(1);
    } catch (error) {
      if (isCatalogueAccessError(error)) {
        this.saveError.set('You do not have permission to add a medicine.');
      } else if (error instanceof HttpErrorResponse && error.status === 422) {
        this.saveError.set('Check the medicine fields and try again.');
      } else {
        this.saveError.set('Could not confirm the save. Reload the catalogue before trying again.');
      }
    } finally {
      this.form.enable();
      this.saving.set(false);
    }
  }

  clearForm(): void {
    this.form.reset();
    this.saveError.set('');
    this.successMessage.set('');
  }
}
