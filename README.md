# HorusCast

Plan outdoor activities with confidence using **hyper-local, trail-aware weather**.  
HorusCast blends NASA climate data, OpenStreetMap trails, and Mapbox maps to help you pick the best day for hiking, stargazing, fishing, snowboarding, and more.

---

## ✨ Features

- **Long-Term Weather Predictions** — explore climate projections out to **2100** (via external datasets).
- **Hyper-Local, Trail-Specific** — click a trail to see conditions at that spot.
- **Interactive Map** — smooth search and explore experience powered by **Mapbox GL JS**.
- **Wildlife & Safety** — room for location-aware alerts (extensible).
- **Offline JSON Log** — every chosen route can be saved to a local JSON store for later analysis.

---

## 🗺️ Live Flow (local)

1. Open the **Welcome** page (index)  
2. Click **Continue** → Map page  
3. Search a city/area (e.g., “Waterloo”)  
4. Nearby **hiking trails** load automatically  
5. Click a trail → it draws on the map and a bottom sheet opens with **NASA** weather for the selected date

> NASA POWER daily data is near-real-time, not a forecast. Very recent dates may be empty — try a date **1–2 days earlier**.

---

## 🧩 Tech Stack

- **Frontend**: HTML/CSS/JS, Mapbox GL JS + Mapbox Geocoder
- **Backend**: Node.js + Express  
  - OpenStreetMap **Overpass API** (trail discovery)  
  - Optional Mapbox Directions (polyline route)  
  - NASA POWER (weather point data)
- **Data**: JSON storage (`mapbox-app/backend/data/*.json`)

---

## 🔧 Prerequisites

- **Node.js** 18+ (or 20+)  
- **Python** (for an ultra-simple static server) or VS Code **Live Server**  
- **Mapbox access token** (public)

---

## 🚀 Local Setup

### 1) Clone

```bash
git clone https://github.com/SushyamNagallapati/NASA-HACKATHON.git
cd repo
