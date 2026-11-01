import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-audience',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './audience.html',
  styleUrl: './audience.scss',
})
export class HomeAudience {}
