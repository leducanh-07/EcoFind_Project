import L from './leaflet-global';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export const GOOGLE_MAP_TILE_URL =
  'https://mt1.google.com/vt/lyrs=m&hl=vi&gl=VN&x={x}&y={y}&z={z}';

export const GOOGLE_MAP_TILE_OPTIONS = {
  maxZoom: 20,
  tileSize: 256,
  attribution: '&copy; Google Maps',
};

export default L;
