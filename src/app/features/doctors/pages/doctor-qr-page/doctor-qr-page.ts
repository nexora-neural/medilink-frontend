import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-doctor-qr-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './doctor-qr-page.html',
  styleUrl: './doctor-qr-page.scss',
})
export class DoctorQrPage {
  printQr(): void {
    window.print();
  }
}
