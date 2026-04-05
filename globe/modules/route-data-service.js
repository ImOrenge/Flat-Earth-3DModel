const DATASET_BASE_PATHS = ["./assets/data", "../assets/data", "/assets/data"];
const DATASET_FILENAMES = Object.freeze({
  countries: ["countries.json"],
  countryCentroids: ["country-centroids.json"],
  airports: ["airports.json"],
  aircraftTypes: ["aircraft-types.json"]
});

const REMOTE_AIRPORTS_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const REMOTE_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
const GEONAMES_PROXY_URL = "/api/geonames/country-info";

const CACHE_KEY = "globe.routes.dataset.v1";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AIRPORTS_PER_COUNTRY_CAP = 15;

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeLongitude(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  let longitude = value;
  while (longitude > 180) {
    longitude -= 360;
  }
  while (longitude < -180) {
    longitude += 360;
  }
  return longitude;
}

function datelineSafeMidpointLongitude(west, east) {
  const westNorm = normalizeLongitude(west);
  const eastNorm = normalizeLongitude(east);
  if (westNorm === null || eastNorm === null) {
    return null;
  }

  let delta = eastNorm - westNorm;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return normalizeLongitude(westNorm + (delta / 2));
}

function buildDatasetPathCandidates(filenames) {
  const candidateFilenames = Array.isArray(filenames) ? filenames : [filenames];
  const paths = [];

  for (const filename of candidateFilenames) {
    for (const basePath of DATASET_BASE_PATHS) {
      paths.push(`${basePath}/${filename}`);
    }
  }

  return paths;
}

async function loadJson(pathCandidates, label, fetchImpl) {
  const attempted = [];
  let lastError = null;

  for (const path of pathCandidates) {
    try {
      const response = await fetchImpl(path, { cache: "no-store" });
      if (!response.ok) {
        attempted.push(`${path} [${response.status}]`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
      attempted.push(`${path} [network-error]`);
    }
  }

  const details = attempted.join(", ");
  const lastErrorMessage = lastError instanceof Error ? ` (${lastError.message})` : "";
  throw new Error(`Failed to load ${label}. Tried: ${details}${lastErrorMessage}`);
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed for ${url} [${response.status}]`);
  }
  return response.json();
}

function sanitizeCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return code.length === 2 ? code : "";
}

function normalizeBundledCountries(rawCountries) {
  if (!Array.isArray(rawCountries)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const country of rawCountries) {
    const alpha2 = sanitizeCountryCode(country?.alpha2);
    if (!alpha2 || seen.has(alpha2)) {
      continue;
    }
    seen.add(alpha2);
    normalized.push({
      alpha2,
      alpha3: String(country?.alpha3 ?? "").trim().toUpperCase(),
      numeric: String(country?.numeric ?? "").trim(),
      name: String(country?.name ?? alpha2).trim(),
      region: String(country?.region ?? "").trim()
    });
  }

  return normalized;
}

function normalizeBundledCentroids(rawCentroids) {
  if (!Array.isArray(rawCentroids)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const centroid of rawCentroids) {
    const alpha2 = sanitizeCountryCode(centroid?.alpha2);
    const latitude = toFiniteNumber(centroid?.latitude);
    const longitude = toFiniteNumber(centroid?.longitude);
    if (!alpha2 || latitude === null || longitude === null || seen.has(alpha2)) {
      continue;
    }
    seen.add(alpha2);
    normalized.push({
      alpha2,
      name: String(centroid?.name ?? alpha2).trim(),
      latitude,
      longitude
    });
  }

  return normalized;
}

function normalizeBundledAirports(rawAirports) {
  if (!Array.isArray(rawAirports)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const airport of rawAirports) {
    const icao = String(airport?.icao ?? "").trim().toUpperCase();
    const iata = String(airport?.iata ?? "").trim().toUpperCase();
    const countryCode = sanitizeCountryCode(airport?.countryCode);
    const latitude = toFiniteNumber(airport?.latitude);
    const longitude = toFiniteNumber(airport?.longitude);

    if (!icao || !iata || !countryCode || latitude === null || longitude === null || seen.has(icao)) {
      continue;
    }

    seen.add(icao);
    normalized.push({
      icao,
      iata,
      name: String(airport?.name ?? icao).trim(),
      city: String(airport?.city ?? countryCode).trim(),
      countryCode,
      latitude,
      longitude
    });
  }

  return normalized.sort((left, right) => (
    compareText(left.countryCode, right.countryCode)
    || compareText(left.city, right.city)
    || compareText(left.iata, right.iata)
    || compareText(left.icao, right.icao)
  ));
}

function normalizeBundledAircraftTypes(rawAircraftTypes) {
  if (!Array.isArray(rawAircraftTypes)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const aircraft of rawAircraftTypes) {
    const icaoCode = String(aircraft?.icaoCode ?? "").trim().toUpperCase();
    if (!icaoCode || seen.has(icaoCode)) {
      continue;
    }

    seen.add(icaoCode);
    normalized.push({
      icaoCode,
      iataCode: String(aircraft?.iataCode ?? "").trim().toUpperCase(),
      name: String(aircraft?.name ?? icaoCode).trim(),
      category: String(aircraft?.category ?? "").trim()
    });
  }

  return normalized;
}

function normalizeRemoteAirports(rawAirports) {
  const values = Array.isArray(rawAirports)
    ? rawAirports
    : Object.values(rawAirports ?? {});

  const dedupedByIcao = new Map();

  for (const airport of values) {
    const icao = String(airport?.icao ?? "").trim().toUpperCase();
    const iata = String(airport?.iata ?? "").trim().toUpperCase();
    const countryCode = sanitizeCountryCode(airport?.country);
    const latitude = toFiniteNumber(airport?.lat);
    const longitude = toFiniteNumber(airport?.lon);

    if (!icao || !iata || !countryCode || latitude === null || longitude === null) {
      continue;
    }

    if (!dedupedByIcao.has(icao)) {
      dedupedByIcao.set(icao, {
        icao,
        iata,
        name: String(airport?.name ?? icao).trim(),
        city: String(airport?.city ?? countryCode).trim(),
        countryCode,
        latitude,
        longitude
      });
    }
  }

  const groupedByCountry = new Map();
  for (const airport of dedupedByIcao.values()) {
    if (!groupedByCountry.has(airport.countryCode)) {
      groupedByCountry.set(airport.countryCode, []);
    }
    groupedByCountry.get(airport.countryCode).push(airport);
  }

  const reduced = [];
  for (const airports of groupedByCountry.values()) {
    airports.sort((left, right) => (
      compareText(left.city, right.city)
      || compareText(left.iata, right.iata)
      || compareText(left.icao, right.icao)
    ));
    reduced.push(...airports.slice(0, AIRPORTS_PER_COUNTRY_CAP));
  }

  return reduced.sort((left, right) => (
    compareText(left.countryCode, right.countryCode)
    || compareText(left.city, right.city)
    || compareText(left.iata, right.iata)
    || compareText(left.icao, right.icao)
  ));
}

function normalizeRemoteCountries(rawCountries, countryCodes) {
  const countriesByCode = new Map();

  for (const country of (Array.isArray(rawCountries) ? rawCountries : [])) {
    const alpha2 = sanitizeCountryCode(country?.cca2);
    if (!alpha2) {
      continue;
    }
    countriesByCode.set(alpha2, {
      alpha2,
      alpha3: String(country?.cca3 ?? "").trim().toUpperCase(),
      numeric: String(country?.ccn3 ?? "").trim(),
      name: String(country?.name?.common ?? country?.name?.official ?? alpha2).trim(),
      region: String(country?.region ?? "").trim(),
      latlng: Array.isArray(country?.latlng) ? country.latlng : null
    });
  }

  const normalized = [];
  for (const alpha2 of countryCodes) {
    const country = countriesByCode.get(alpha2);
    if (country) {
      normalized.push({
        alpha2: country.alpha2,
        alpha3: country.alpha3,
        numeric: country.numeric,
        name: country.name,
        region: country.region
      });
    } else {
      normalized.push({
        alpha2,
        alpha3: "",
        numeric: "",
        name: alpha2,
        region: ""
      });
    }
  }

  return normalized.sort((left, right) => compareText(left.name, right.name));
}

function buildCentroidsFromCountries(rawCountries, countryCodes) {
  const centroids = new Map();
  for (const country of (Array.isArray(rawCountries) ? rawCountries : [])) {
    const alpha2 = sanitizeCountryCode(country?.cca2);
    if (!alpha2 || !countryCodes.has(alpha2)) {
      continue;
    }
    const latlng = Array.isArray(country?.latlng) ? country.latlng : [];
    const latitude = toFiniteNumber(latlng[0]);
    const longitude = toFiniteNumber(latlng[1]);
    if (latitude === null || longitude === null) {
      continue;
    }
    centroids.set(alpha2, {
      alpha2,
      name: String(country?.name?.common ?? alpha2).trim(),
      latitude,
      longitude
    });
  }
  return centroids;
}

function extractGeoNamesRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.countries)) {
    return payload.countries;
  }
  if (Array.isArray(payload?.geonames)) {
    return payload.geonames;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function buildCentroidsFromGeoNames(rows, countryCodes) {
  const centroids = new Map();

  for (const row of rows) {
    const alpha2 = sanitizeCountryCode(row?.alpha2 ?? row?.countryCode ?? row?.country);
    if (!alpha2 || !countryCodes.has(alpha2)) {
      continue;
    }

    const north = toFiniteNumber(row?.north);
    const south = toFiniteNumber(row?.south);
    const east = toFiniteNumber(row?.east);
    const west = toFiniteNumber(row?.west);
    if (north === null || south === null || east === null || west === null) {
      continue;
    }

    const latitude = (north + south) / 2;
    const longitude = datelineSafeMidpointLongitude(west, east);
    if (longitude === null) {
      continue;
    }

    centroids.set(alpha2, {
      alpha2,
      name: String(row?.name ?? row?.countryName ?? alpha2).trim(),
      latitude,
      longitude
    });
  }

  return centroids;
}

function buildAirportFallbackCentroids(airports) {
  const countryStats = new Map();

  for (const airport of airports) {
    if (!countryStats.has(airport.countryCode)) {
      countryStats.set(airport.countryCode, {
        latitudeSum: 0,
        longitudeSum: 0,
        count: 0
      });
    }
    const stats = countryStats.get(airport.countryCode);
    stats.latitudeSum += airport.latitude;
    stats.longitudeSum += airport.longitude;
    stats.count += 1;
  }

  const centroids = new Map();
  for (const [countryCode, stats] of countryStats.entries()) {
    if (stats.count <= 0) {
      continue;
    }
    centroids.set(countryCode, {
      alpha2: countryCode,
      name: countryCode,
      latitude: stats.latitudeSum / stats.count,
      longitude: stats.longitudeSum / stats.count
    });
  }

  return centroids;
}

function mergeCentroids({ countries, airports, fromCountries, fromGeoNames }) {
  const airportFallback = buildAirportFallbackCentroids(airports);
  const merged = [];

  for (const country of countries) {
    const alpha2 = country.alpha2;
    const centroid = fromGeoNames.get(alpha2)
      ?? fromCountries.get(alpha2)
      ?? airportFallback.get(alpha2);

    if (!centroid) {
      continue;
    }

    merged.push({
      alpha2,
      name: country.name,
      latitude: centroid.latitude,
      longitude: centroid.longitude
    });
  }

  return merged.sort((left, right) => compareText(left.name, right.name));
}

function getSafeStorage(storage) {
  if (storage) {
    return storage;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadCachedDataset(storage) {
  if (!storage) {
    return { status: "unavailable", payload: null };
  }

  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) {
      return { status: "missing", payload: null };
    }

    const parsed = JSON.parse(raw);
    const validShape = parsed
      && parsed.version === CACHE_VERSION
      && Number.isFinite(parsed.fetchedAt)
      && Array.isArray(parsed.countries)
      && Array.isArray(parsed.countryCentroids)
      && Array.isArray(parsed.airports);

    if (!validShape) {
      storage.removeItem(CACHE_KEY);
      return { status: "invalid", payload: null };
    }

    const ageMs = Date.now() - parsed.fetchedAt;
    if (ageMs > CACHE_TTL_MS) {
      storage.removeItem(CACHE_KEY);
      return { status: "expired", payload: null };
    }

    return {
      status: "valid",
      payload: {
        source: String(parsed.source ?? "cached"),
        fetchedAt: parsed.fetchedAt,
        countries: parsed.countries,
        countryCentroids: parsed.countryCentroids,
        airports: parsed.airports
      }
    };
  } catch {
    try {
      storage.removeItem(CACHE_KEY);
    } catch {}
    return { status: "invalid", payload: null };
  }
}

function saveCachedDataset(storage, payload) {
  if (!storage) {
    return;
  }

  try {
    const cachePayload = {
      version: CACHE_VERSION,
      fetchedAt: payload.fetchedAt,
      source: payload.source,
      countries: payload.countries,
      countryCentroids: payload.countryCentroids,
      airports: payload.airports
    };
    storage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
  } catch {}
}

async function fetchGeoNamesCountryInfo(fetchImpl, language) {
  const lang = String(language ?? "en").toLowerCase().startsWith("ko") ? "ko" : "en";
  const url = `${GEONAMES_PROXY_URL}?lang=${encodeURIComponent(lang)}`;
  return fetchJson(url, fetchImpl);
}

export function createRouteDataService({
  fetchImpl = (...args) => fetch(...args),
  storage = null
} = {}) {
  const safeStorage = getSafeStorage(storage);

  async function loadBundledDataset() {
    const [countriesRaw, countryCentroidsRaw, airportsRaw, aircraftTypesRaw] = await Promise.all([
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.countries), "countries", fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.countryCentroids), "countryCentroids", fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.airports), "airports", fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.aircraftTypes), "aircraftTypes", fetchImpl)
    ]);

    return {
      countries: normalizeBundledCountries(countriesRaw),
      countryCentroids: normalizeBundledCentroids(countryCentroidsRaw),
      airports: normalizeBundledAirports(airportsRaw),
      aircraftTypes: normalizeBundledAircraftTypes(aircraftTypesRaw)
    };
  }

  async function loadInitialDataset() {
    const bundled = await loadBundledDataset();
    const cacheEntry = loadCachedDataset(safeStorage);

    if (cacheEntry.status === "valid" && cacheEntry.payload) {
      return {
        source: "cached",
        fetchedAt: cacheEntry.payload.fetchedAt,
        shouldAutoRefresh: false,
        warnings: [],
        dataset: {
          countries: normalizeBundledCountries(cacheEntry.payload.countries),
          countryCentroids: normalizeBundledCentroids(cacheEntry.payload.countryCentroids),
          airports: normalizeBundledAirports(cacheEntry.payload.airports),
          aircraftTypes: bundled.aircraftTypes
        }
      };
    }

    return {
      source: "bundled",
      fetchedAt: null,
      shouldAutoRefresh: cacheEntry.status === "missing"
        || cacheEntry.status === "expired"
        || cacheEntry.status === "invalid"
        || cacheEntry.status === "unavailable",
      warnings: [],
      dataset: bundled
    };
  }

  async function refreshRemote({ language = "en", forceRemote = false } = {}) {
    void forceRemote;
    const [airportsRaw, countriesRaw] = await Promise.all([
      fetchJson(REMOTE_AIRPORTS_URL, fetchImpl),
      fetchJson(REMOTE_COUNTRIES_URL, fetchImpl)
    ]);

    const airports = normalizeRemoteAirports(airportsRaw);
    if (airports.length < 2) {
      throw new Error("Remote airport dataset is insufficient for routing.");
    }

    const countryCodes = new Set(airports.map((airport) => airport.countryCode));
    const countries = normalizeRemoteCountries(countriesRaw, countryCodes);
    const centroidsFromCountries = buildCentroidsFromCountries(countriesRaw, countryCodes);

    const warnings = [];
    let geoNamesRows = [];

    try {
      const geoNamesPayload = await fetchGeoNamesCountryInfo(fetchImpl, language);
      geoNamesRows = extractGeoNamesRows(geoNamesPayload);
    } catch {
      warnings.push("geonames_unavailable");
    }

    const centroidsFromGeoNames = buildCentroidsFromGeoNames(geoNamesRows, countryCodes);
    const countryCentroids = mergeCentroids({
      countries,
      airports,
      fromCountries: centroidsFromCountries,
      fromGeoNames: centroidsFromGeoNames
    });

    const fetchedAt = Date.now();
    saveCachedDataset(safeStorage, {
      fetchedAt,
      source: "live_api",
      countries,
      countryCentroids,
      airports
    });

    return {
      source: "live_api",
      fetchedAt,
      warnings,
      dataset: {
        countries,
        countryCentroids,
        airports
      }
    };
  }

  return {
    loadInitialDataset,
    refreshRemote
  };
}
