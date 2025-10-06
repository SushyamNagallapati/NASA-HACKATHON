(async () => {
  const BACKEND_URL = window.BACKEND_URL || 'http://localhost:3000';

  // util toast
  function toast(msg, ms=2000){
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(()=> t.style.display='none', ms);
  }

  // load token
  let MAPBOX_TOKEN = '';
  try { MAPBOX_TOKEN = (await (await fetch(`${BACKEND_URL}/token`)).json()).token || ''; } catch {}
  if (!MAPBOX_TOKEN) MAPBOX_TOKEN = 'pk.eyJ1Ijoic3VzaHlhbTA1IiwiYSI6ImNtZ2Q0d2lkeDBldmMybW83OW1kZGs3bm4ifQ.2DBdhuCVTFkhtk72Lzp6rQ';
  mapboxgl.accessToken = MAPBOX_TOKEN;

  // map
  const DEFAULT_CENTER = [-80.5204, 43.4643]; // Waterloo-ish
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: DEFAULT_CENTER,
    zoom: 11
  });
  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
  const mapReady = new Promise(res => map.once('load', res));

  // geocoder (place-level search)
  const geocoder = new MapboxGeocoder({
    accessToken: MAPBOX_TOKEN,
    mapboxgl,
    placeholder: 'Search a city/area (e.g., Waterloo)…',
    marker: false,
    flyTo: false,
    types: 'place,locality,region,district,neighborhood,postcode'
  });
  document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

  // state
  let currentPlace = null;

  // layers ids
  const SPOTS_SRC = 'hike-spots-src';
  const SPOTS_LAYER = 'hike-spots-layer';
  const TRAIL_SRC = 'trail-src';
  const TRAIL_LAYER = 'trail-layer';

  await mapReady;

  // add empty sources
  map.addSource(SPOTS_SRC, { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
  map.addLayer({
    id: SPOTS_LAYER,
    type: 'circle',
    source: SPOTS_SRC,
    paint: {
      'circle-radius': 6,
      'circle-color': '#2ecc71',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2
    }
  });

  // add trail source/layer lazily
  function ensureTrailLayers(){
    if (!map.getSource(TRAIL_SRC)) {
      map.addSource(TRAIL_SRC, { type:'geojson', data: { type:'FeatureCollection', features: [] } });
      map.addLayer({
        id: TRAIL_LAYER,
        type: 'line',
        source: TRAIL_SRC,
        layout: { 'line-cap':'round', 'line-join':'round' },
        paint: { 'line-color':'#3478F6', 'line-width':5, 'line-opacity':0.9 }
      });
    }
  }

  // click handler for spots
  map.on('click', SPOTS_LAYER, async (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    const { id, name } = f.properties;

    toast(`Loading trail: ${name}…`);

    // fetch trail geometry
    let tr = null;
    try {
      const r = await fetch(`${BACKEND_URL}/trail?id=${encodeURIComponent(id)}`);
      tr = await r.json();
    } catch {}
    if (!tr || !tr.geometry) { toast('No trail geometry found'); return; }

    ensureTrailLayers();
    const feat = { type:'Feature', properties:{ name: tr.name }, geometry: tr.geometry };
    map.getSource(TRAIL_SRC).setData({ type:'FeatureCollection', features:[feat] });

    // fit to trail bounds
    const bounds = new mapboxgl.LngLatBounds();
    if (tr.geometry.type === 'LineString') {
      for (const [lng, lat] of tr.geometry.coordinates) bounds.extend([lng, lat]);
    } else {
      for (const line of tr.geometry.coordinates) for (const [lng, lat] of line) bounds.extend([lng, lat]);
    }
    map.fitBounds(bounds, { padding: 80, duration: 700 });

    // save JSON as requested (start/end of the trail)
    const s = tr.start, e2 = tr.end;
    const payload = {
      start: `Trail: ${tr.name} - start`,
      end:   `Trail: ${tr.name} - end`,
      latitude: [s.lat, e2.lat],
      longitude:[s.lng, e2.lng],
      timestamp: new Date().toISOString()
    };
    try {
      await fetch(`${BACKEND_URL}/journeys`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
    } catch {}
  });

  // cursor feedback
  map.on('mouseenter', SPOTS_LAYER, () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', SPOTS_LAYER, () => map.getCanvas().style.cursor = '');

  // when a place is selected → fetch hiking spots and show
  geocoder.on('result', async (e) => {
    currentPlace = e.result;
    const [lng, lat] = currentPlace.center;

    toast('Searching hiking spots nearby…');
    let spots = null;
    try {
      const r = await fetch(`${BACKEND_URL}/hikes?lat=${lat}&lng=${lng}&radius=8000`);
      const j = await r.json();
      spots = j.spots || [];
    } catch (err) {
      console.warn(err);
    }

    // build points GeoJSON
    const fc = {
      type: 'FeatureCollection',
      features: (spots || []).map(s => ({
        type:'Feature',
        geometry:{ type:'Point', coordinates:[s.center.lng, s.center.lat] },
        properties:{ id: s.id, name: s.name }
      }))
    };
    map.getSource(SPOTS_SRC).setData(fc);

    // fit to the place area (zoom in a bit)
    map.easeTo({ center:[lng, lat], zoom: 12, duration: 500 });

    toast(`${fc.features.length} hiking spot(s) found`);
  });

  // CTA placeholder
  document.getElementById('activity-btn').addEventListener('click', () => {
    alert('Activity picker coming soon');
  });
})();
