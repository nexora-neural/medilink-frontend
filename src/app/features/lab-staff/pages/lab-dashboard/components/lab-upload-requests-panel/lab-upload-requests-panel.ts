import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-lab-upload-requests-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './lab-upload-requests-panel.html',
  styleUrl: './lab-upload-requests-panel.scss',
})
export class LabUploadRequestsPanel {}
