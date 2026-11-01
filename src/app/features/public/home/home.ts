import { Component } from '@angular/core';
import { HomeHero } from './components/hero/hero';
import { HomeValue } from './components/value/value';
import { HomeIntroduction } from './components/introduction/introduction';
import { HomeOffers } from './components/offers/offers';
import { HomeJourney } from './components/journey/journey';
import { HomeAudience } from './components/audience/audience';
import { HomeStory } from './components/story/story';
import { HomeFaq } from './components/faq/faq';
import { HomeClosing } from './components/closing/closing';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    HomeHero,
    HomeValue,
    HomeIntroduction,
    HomeOffers,
    HomeJourney,
    HomeAudience,
    HomeStory,
    HomeFaq,
    HomeClosing,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class PublicHome {}

export { PublicHome as Home };
