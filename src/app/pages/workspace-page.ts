import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActiveRoleService } from '../core/active-role.service';
import { FormField } from '../shared/form-field';
import { UiState, UiStateKind } from '../shared/ui-state';
@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormField, UiState],
  templateUrl: './workspace-page.html',
  styleUrl: './workspace-page.scss',
})
export class WorkspacePage {
  private readonly formBuilder = inject(FormBuilder);
  readonly activeRole = inject(ActiveRoleService).activeRole;
  title = 'Workspace overview';
  description = 'A responsive MediLink workspace foundation for role-aware navigation.';
  selectedState: UiStateKind = 'empty';
  submitted = false;
  formMessage = '';
  readonly previewForm = this.formBuilder.nonNullable.group({
    displayName: ['', Validators.required],
    category: ['General', Validators.required],
    note: [''],
  });
  constructor(route: ActivatedRoute) {
    route.data.subscribe((data) => {
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
