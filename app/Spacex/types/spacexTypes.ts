export interface Patch {
    small: string;
    large: string;
  }
  
  export interface LaunchLinks {
    patch: Patch;
    reddit?: {
      campaign?: string;
      launch?: string;
      media?: string;
      recovery?: string;
    };
    flickr?: {
      small?: string[];
      original?: string[];
    };
    presskit?: string;
    webcast?: string;
    youtube_id?: string;
    article?: string;
    wikipedia?: string;
  }
  
  export interface LaunchData {
    name: string;
    date_utc: string;
    details: string | null;
    flight_number: number;
    links: LaunchLinks;
    // Include any additional data that might be returned.
    [key: string]: any;
  }
  
  export interface Rocket {
    id: string;
    name: string;
    description: string;
    [key: string]: any;
  }
  
  export interface StarlinkData {
    id: string;
    version: string;
    launch?: string;
    [key: string]: any;
  }
  
  export interface Launchpad {
    id: string;
    name: string;
    details: string;
    locality: string;
    region: string;
    [key: string]: any;
  }
  
  export interface Core {
    id: string;
    serial: string;
    status: string;
    [key: string]: any;
  }
  
  export interface Capsule {
    id: string;
    serial: string;
    status: string;
    [key: string]: any;
  }
  
  export interface Payload {
    id: string;
    name: string;
    type: string;
    [key: string]: any;
  }
  