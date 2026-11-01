import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
export type UiStateKind = 'loading' | 'error' | 'empty';
@Component({
  selector: 'app-ui-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-state.html',
  styleUrl: './ui-state.scss',
})
export class UiState {
  @Input() kind: UiStateKind = 'empty';
  @Input() title = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
  get icon(): string {
    return this.kind === 'loading'
      ? 'progress_activity'
      : this.kind === 'error'
        ? 'error_outline'
        : 'inbox';
  }
}
