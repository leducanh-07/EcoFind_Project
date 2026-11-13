import L from 'leaflet';

if (typeof window !== 'undefined') {
  window.L = L;
}
if (typeof globalThis !== 'undefined') {
  globalThis.L = L;
}

export default L;
