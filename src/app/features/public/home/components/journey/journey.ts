import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-journey',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './journey.html',
  styleUrl: './journey.scss',
})
export class HomeJourney {}
