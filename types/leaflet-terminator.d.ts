declare module 'leaflet-terminator' {
  import * as L from 'leaflet';
  function leafletTerminator(options?: L.PolylineOptions): L.Polygon;
  export default leafletTerminator;
}
