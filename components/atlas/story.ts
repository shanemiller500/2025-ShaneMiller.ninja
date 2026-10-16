/* ------------------------------------------------------------------ */
/*  Guided stories for atlas maps: chapters that move the camera,      */
/*  tell what happened, offer buttons that open the map's tools, and   */
/*  cite the papers behind them. The project decides what an action    */
/*  `kind` does (Earth Alive: replay a sequence, open the 3D view…).   */
/* ------------------------------------------------------------------ */

export interface StoryCamera {
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface StoryAction<K extends string = string> {
  label: string;
  kind: K;
  /** project-specific argument: an event id, a region key, a layer id… */
  value?: string | number;
}

/** A source behind the story. `url` is the original; the library may hold a hosted copy. */
export interface StoryDoc {
  title: string;
  url: string;
  source: string;
  year?: number;
}

export interface StoryChapter<K extends string = string> {
  title: string;
  /** shown above the title, e.g. "March 27, 1964" */
  date?: string;
  body: string[];
  camera: StoryCamera;
  actions?: StoryAction<K>[];
}

export interface AtlasStory<K extends string = string> {
  id: string;
  title: string;
  subtitle: string;
  /** e.g. "1964" or "1811–12" */
  when: string;
  /** accent for the story card */
  color: string;
  chapters: StoryChapter<K>[];
  docs: StoryDoc[];
}
