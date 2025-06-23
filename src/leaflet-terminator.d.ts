declare module 'leaflet-terminator' {
  import * as L from 'leaflet';

  export default function terminator(date?: Date): L.GeoJSON;
}
