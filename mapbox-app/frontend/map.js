/* Trails + NASA weather: search area, show spots, click draws trail and opens bottom sheet */

(async () => {
  // --------- tiny utils ----------
  const $ = (s) => document.querySelector(s);
  const todayISO = () => new Date().toISOString().slice(0,10);
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.hidden = false; setTimeout(()=> t.hidden = true, 2000); };

  // --------- date control ----------
  const dateInput = $('#date-input');
  dateInput.value = todayISO();
  let SELECTED_DATE = dateInput.value;
  dateInput.addEventListener('change', () => { SELECTED_DATE = dateInput.value || todayISO(); });

  // --------- bottom sheet ----------
  const sheetEl = $('#sheet');
  const sheetBody = $('#sheet-body');
  const sheetTitle = $('#sheet-title');
  const sheetSub = $('#sheet-sub');
  const scrim = $('#sheet-scrim');
  $('#sheet-close').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);

  function openSheet(){ sheetEl.classList.add('sheet--open'); scrim.classList.add('sheet--open'); sheetEl.setAttribute('aria-hidden','false'); }
  function closeSheet(){ sheetEl.classList.remove('sheet--open'); scrim.classList.remove('sheet--open'); sheetEl.setAttribute('aria-hidden','true'); }

  function renderNasaTable(rows){
    const trs = rows.map(r => `
      <tr>
        <td>${r.label}</td>
        <td>${r.value ?? '—'}</td>
        <td style="color:#667085">${r.unit || ''}</td>
      </tr>`).join('');
    return `<table class="wx-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead><tbody>${trs}</tbody></table>`;
  }

  // --------- script/CSS fallbacks for Geocoder ----------
  function loadScriptFromAny(urls) {
    return new Promise((resolve, reject) => {
      let i = 0;
      const tryNext = () => {
        if (i >= urls.length) return reject(new Error('All script sources failed'));
        const s = document.createElement('script');
        s.src = urls[i++]; s.async = false;
        s.onload = () => resolve();
        s.onerror = () => tryNext();
        document.head.appendChild(s);
      };
      tryNext();
    });
  }
  function loadCss(href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  // --------- Mapbox GL ensure ----------
  if (!window.mapboxgl) {
    await loadScriptFromAny(['https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js']);
  }
  if (!window.mapboxgl) { console.error('Mapbox GL failed'); return; }

  // --------- config/token ----------
  const BACKEND_URL =
    window.BACKEND_URL ||
    (location.hostname.includes('github.io') ? 'https://YOUR-BACKEND.example.com' : 'http://localhost:4000');

  let MAPBOX_TOKEN = '';
  try {
    const tok = await (await fetch(`${BACKEND_URL}/token`)).json();
    MAPBOX_TOKEN = tok.token || '';
  } catch {}
  if (!MAPBOX_TOKEN) {
    MAPBOX_TOKEN = 'pk.eyJ1Ijoic3VzaHlhbTA1IiwiYSI6ImNtZ2Q0d2lkeDBldmMybW83OW1kZGs3bm4ifQ.2DBdhuCVTFkhtk72Lzp6rQ';
  }
  mapboxgl.accessToken = MAPBOX_TOKEN;

  // --------- build map ----------
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-79.3832, 43.6532], zoom: 11
  });
  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
  map.on('error', e => console.error('[mapbox]', e?.error || e));
  await new Promise(res => map.once('load', res));

  // --------- Geocoder (with fallback input) ----------
  const GEOCODER_JS = [
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.1/mapbox-gl-geocoder.min.js',
    'https://cdn.jsdelivr.net/npm/@mapbox/mapbox-gl-geocoder@5.0.1/dist/mapbox-gl-geocoder.min.js',
    'https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.1/dist/mapbox-gl-geocoder.min.js'
  ];
  const GEOCODER_CSS = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.1/mapbox-gl-geocoder.css';
  let geocoderLoaded = true;
  if (!window.MapboxGeocoder) {
    loadCss(GEOCODER_CSS);
    await loadScriptFromAny(GEOCODER_JS).catch(()=> geocoderLoaded = false);
  }
  const geocoderHost = $('#geocoder');

  // store current markers so we can clear when searching again
  let spotMarkers = [];
  function clearMarkers(){ spotMarkers.forEach(m => m.remove()); spotMarkers = []; }

  async function fetchHikes(lat, lng, radius=12000){
    const resp = await fetch(`${BACKEND_URL}/hikes?lat=${lat}&lng=${lng}&radius=${radius}`);
    const data = await resp.json();
    clearMarkers();
    const spots = data.spots || [];
    if (!spots.length) { toast('No hikes found here'); return; }
    for (const s of spots) {
      const el = document.createElement('div');
      el.style.width = el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.background = '#22c55e';   // green dot
      el.style.boxShadow = '0 0 0 2px #fff';
      const marker = new mapboxgl.Marker(el).setLngLat([s.center.lng, s.center.lat]).addTo(map);
      marker.getElement().title = s.name;
      marker.getElement().style.cursor = 'pointer';
      marker.getElement().addEventListener('click', () => showTrail(s.id, s.name));
      spotMarkers.push(marker);
    }
    toast(`${spots.length} hike spots found`);
  }

  // draw selected trail
  const TRAIL_SRC = 'trail-src';
  const TRAIL_LAYER = 'trail-line';
  function setTrailGeoJSON(geojson){
    if (!map.getSource(TRAIL_SRC)) {
      map.addSource(TRAIL_SRC, { type: 'geojson', data: geojson });
      map.addLayer({
        id: TRAIL_LAYER, type: 'line', source: TRAIL_SRC,
        paint: { 'line-color':'#0ea5e9', 'line-width':4 }
      });
    } else {
      map.getSource(TRAIL_SRC).setData(geojson);
    }
  }
  function boundsFromGeom(geometry){
    const b = new mapboxgl.LngLatBounds();
    const pushCoord = (c) => b.extend(c);
    if (geometry.type === 'LineString') geometry.coordinates.forEach(pushCoord);
    if (geometry.type === 'MultiLineString') geometry.coordinates.flat().forEach(pushCoord);
    return b;
  }

  async function showTrail(id, name){
    try{
      const t = await (await fetch(`${BACKEND_URL}/trail?id=${encodeURIComponent(id)}`)).json();
      const geo = { type:'Feature', geometry: t.geometry, properties: { name: t.name } };
      setTrailGeoJSON(geo);
      const b = boundsFromGeom(t.geometry);
      map.fitBounds(b, { padding: 60, duration: 700 });

      // NASA weather for the trail's center + date
      const center = b.getCenter();
      const date = SELECTED_DATE || todayISO();
      const wx = await (await fetch(`${BACKEND_URL}/nasa?lat=${center.lat}&lng=${center.lng}&date=${date}`)).json();

      sheetTitle.textContent = t.name || name || 'Trail';
      sheetSub.textContent   = `${wx.date} • ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
      sheetBody.innerHTML    = renderNasaTable(wx.table || []);
      openSheet();
    }catch(err){
      console.warn('trail failed', err);
      toast('Could not load trail');
    }
  }

  function bboxCenter(bbox){   // [minX,minY,maxX,maxY] -> [lng,lat]
    return [(bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2];
  }

  if (geocoderLoaded && window.MapboxGeocoder) {
    const gc = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN, mapboxgl, marker: false, flyTo: false,
      placeholder: 'Search area (e.g., Waterloo, Banff)…',
      types: 'place,locality,region,district,neighborhood,postcode'
    });
    gc.addTo(geocoderHost);

    gc.on('result', async (e) => {
      const r = e.result;
      let center, radius = 12000;
      if (r.bbox) {
        const b = new mapboxgl.LngLatBounds([r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]);
        map.fitBounds(b, { padding: { top: 140, bottom: 40, left: 40, right: 40 }, duration: 700 });
        const c = b.getCenter(); center = [c.lng, c.lat];
        // derive a radius roughly from bbox size
        radius = Math.min(25000, Math.max(6000, Math.hypot(r.bbox[2]-r.bbox[0], r.bbox[3]-r.bbox[1]) * 70000));
      } else if (r.center) {
        center = r.center;
        map.easeTo({ center, zoom: 12, duration: 500 });
      }
      if (center) await fetchHikes(center[1], center[0], radius);
    });
  } else {
    // Fallback basic input
    const input = document.createElement('input');
    input.className = 'fallback-input';
    input.placeholder = 'Search area (e.g., Waterloo, Banff)…';
    geocoderHost.appendChild(input);

    async function doSearch(q){
      if (!q?.trim()) return;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${mapboxgl.accessToken}&types=place,locality,region,district,neighborhood,postcode&limit=1`;
      const j = await (await fetch(url)).json();
      const f = j.features?.[0];
      if (!f) return;
      let center, radius = 12000;
      if (f.bbox) {
        const b = new mapboxgl.LngLatBounds([f.bbox[0], f.bbox[1]], [f.bbox[2], f.bbox[3]]);
        map.fitBounds(b, { padding: { top: 140, bottom: 40, left: 40, right: 40 }, duration: 700 });
        const c = b.getCenter(); center = [c.lng, c.lat];
      } else if (f.center) {
        center = f.center; map.easeTo({ center, zoom: 12, duration: 500 });
      }
      if (center) await fetchHikes(center[1], center[0], radius);
    }
    input.addEventListener('keydown', (ev)=> { if (ev.key === 'Enter') doSearch(input.value); });
  }
})();
