import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { UiState, UiStateKind } from '../../../../shared/components/ui-state/ui-state';
import { PatientDashboard } from '../../../patients/pages/patient-dashboard/patient-dashboard';
@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [ReactiveFormsModule, FormField, UiState, PatientDashboard],
  templateUrl: './workspace-page.html',
  styleUrl: './workspace-page.scss',
})
export class WorkspacePage {
  private readonly formBuilder = inject(FormBuilder);
  readonly activeRole = inject(ActiveRoleService).activeRole;
  private readonly router = inject(Router);
  title = 'Workspace overview';
  description = 'A responsive MediLink workspace foundation for role-aware navigation.';
  selectedState: UiStateKind = 'empty';
  submitted = false;
  formMessage = '';
  get isPatientOverview(): boolean {
    return this.activeRole() === 'Patient' && this.router.url.split(/[?#]/)[0] === '/workspace';
  }
  readonly previewForm = this.formBuilder.nonNullable.group({
    displayName: ['', Validators.required],
    category: ['General', Validators.required],
    note: [''],
  });
  private readonly route = inject(ActivatedRoute);
  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.title = data['title'] ?? 'Workspace overview';
      this.description =
        data['description'] ??
        'A responsive MediLink workspace foundation for role-aware navigation.';
    });
  }
  get nameError(): string {
    return this.submitted && this.previewForm.controls.displayName.invalid
      ? 'Enter a display name to continue.'
      : '';
  }
  submitPreview(): void {
    this.submitted = true;
    this.formMessage = '';
    if (this.previewForm.invalid) return;
    this.formMessage = 'Sample form submitted locally. No data was sent.';
    this.previewForm.reset({ displayName: '', category: 'General', note: '' });
    this.submitted = false;
  }
}
