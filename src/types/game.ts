export type Language = 'hi' | 'te' | 'ta' | 'ml';

export type ViewState = 'home' | 'landing' | 'playing' | 'gameover';

export interface Movie {
  id?: number | string;
  title: string;
  year: number | string;
  imdb_rating: number;
  poster_path: string | null;
  language: string;
}

export interface Industry {
  id: Language;
  name: string;
  languageName: string;
  tagline: string;
  accentColor: string;
  hoverColor: string;
}
