import { Component, Input } from '@angular/core';
@Component({
  selector: 'ml-form-field',
  standalone: true,
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
})
export class FormField {
  @Input({ required: true }) fieldId = '';
  @Input({ required: true }) label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
}
