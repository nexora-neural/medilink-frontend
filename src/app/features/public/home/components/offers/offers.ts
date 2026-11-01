import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-offers',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './offers.html',
  styleUrl: './offers.scss',
})
export class HomeOffers {}
