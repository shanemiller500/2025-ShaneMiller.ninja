declare module 'leaflet-terminator' {
  import * as L from 'leaflet';
  function leafletTerminator(date?: Date, options?: L.GeoJSONOptions): L.GeoJSON;
  export default leafletTerminator;
}
