import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-story',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './story.html',
  styleUrl: './story.scss',
})
export class HomeStory {}
