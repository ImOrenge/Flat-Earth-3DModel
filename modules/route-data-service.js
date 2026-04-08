const DATASET_BASE_PATHS = ["./assets/data", "../assets/data", "/assets/data"];
const DATASET_FILENAMES = Object.freeze({
  countries: ["countries.json"],
  airports: ["airports.json"],
  aircraftTypes: ["aircraft-types.json"]
});

const REMOTE_AIRPORTS_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const REMOTE_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

const CACHE_KEY = "routes.dataset.v1";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AIRPORTS_PER_COUNTRY_CAP = 15;
const PINNED_AIRPORT_IATA = Object.freeze([
  "SCL", "LAX", "SYD",
  "JFK", "DFW", "MIA", "GRU", "LIM",
  "LHR", "CDG", "FRA", "AMS", "MAD", "IST",
  "JNB", "CAI", "ADD", "NBO", "CMN",
  "DXB", "DOH", "SIN", "HKG", "ICN", "NRT",
  "MEL", "BNE", "PER", "AKL",
  "ORD", "ATL"
]);
const PINNED_AIRPORT_PRIORITY = new Map(
  PINNED_AIRPORT_IATA.map((iata, index) => [iata, index])
);

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return code.length === 2 ? code : "";
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

    const pinnedAirports = [];
    const regularAirports = [];
    for (const airport of airports) {
      if (PINNED_AIRPORT_PRIORITY.has(airport.iata)) {
        pinnedAirports.push(airport);
      } else {
        regularAirports.push(airport);
      }
    }

    pinnedAirports.sort((left, right) => (
      (PINNED_AIRPORT_PRIORITY.get(left.iata) ?? Number.MAX_SAFE_INTEGER)
      - (PINNED_AIRPORT_PRIORITY.get(right.iata) ?? Number.MAX_SAFE_INTEGER)
      || compareText(left.city, right.city)
      || compareText(left.icao, right.icao)
    ));

    const prioritized = [...pinnedAirports, ...regularAirports];
    reduced.push(...prioritized.slice(0, AIRPORTS_PER_COUNTRY_CAP));
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
      region: String(country?.region ?? "").trim()
    });
  }

  const normalized = [];
  for (const alpha2 of countryCodes) {
    const country = countriesByCode.get(alpha2);
    if (country) {
      normalized.push(country);
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
      airports: payload.airports
    };
    storage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
  } catch {}
}

export function createRouteDataService({
  fetchImpl = (...args) => fetch(...args),
  storage = null,
  sourceMode = "remote"
} = {}) {
  const safeStorage = getSafeStorage(storage);
  const normalizedSourceMode = String(sourceMode ?? "remote").toLowerCase();
  const bundledOnly = normalizedSourceMode === "bundled";
  const remoteOnly = normalizedSourceMode === "remote";

  async function loadBundledDataset() {
    const [countriesRaw, airportsRaw, aircraftTypesRaw] = await Promise.all([
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.countries), "countries", fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.airports), "airports", fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.aircraftTypes), "aircraftTypes", fetchImpl)
    ]);

    return {
      countries: normalizeBundledCountries(countriesRaw),
      airports: normalizeBundledAirports(airportsRaw),
      aircraftTypes: normalizeBundledAircraftTypes(aircraftTypesRaw)
    };
  }

  async function refreshRemote() {
    const [airportsRaw, countriesRaw, bundledAircraftTypes] = await Promise.all([
      fetchJson(REMOTE_AIRPORTS_URL, fetchImpl),
      fetchJson(REMOTE_COUNTRIES_URL, fetchImpl),
      loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.aircraftTypes), "aircraftTypes", fetchImpl)
    ]);

    const airports = normalizeRemoteAirports(airportsRaw);
    if (airports.length < 2) {
      throw new Error("Remote airport dataset is insufficient for routing.");
    }

    const countryCodes = new Set(airports.map((airport) => airport.countryCode));
    const countries = normalizeRemoteCountries(countriesRaw, countryCodes);
    const aircraftTypes = normalizeBundledAircraftTypes(bundledAircraftTypes);
    const fetchedAt = Date.now();

    saveCachedDataset(safeStorage, {
      fetchedAt,
      source: "live_api",
      countries,
      airports
    });

    return {
      source: "live_api",
      fetchedAt,
      warnings: [],
      dataset: {
        countries,
        airports,
        aircraftTypes
      }
    };
  }

  async function loadInitialDataset() {
    const bundled = await loadBundledDataset();
    if (bundledOnly) {
      return {
        source: "bundled",
        fetchedAt: null,
        shouldAutoRefresh: false,
        warnings: [],
        dataset: bundled
      };
    }

    const cacheEntry = loadCachedDataset(safeStorage);

    if (remoteOnly) {
      try {
        const remote = await refreshRemote();
        return {
          source: remote.source ?? "live_api",
          fetchedAt: remote.fetchedAt ?? Date.now(),
          shouldAutoRefresh: false,
          warnings: remote.warnings ?? [],
          dataset: remote.dataset
        };
      } catch {
        if (cacheEntry.status === "valid" && cacheEntry.payload) {
          return {
            source: "cached",
            fetchedAt: cacheEntry.payload.fetchedAt,
            shouldAutoRefresh: true,
            warnings: ["remote_unavailable"],
            dataset: {
              countries: normalizeBundledCountries(cacheEntry.payload.countries),
              airports: normalizeBundledAirports(cacheEntry.payload.airports),
              aircraftTypes: bundled.aircraftTypes
            }
          };
        }

        return {
          source: "bundled",
          fetchedAt: null,
          shouldAutoRefresh: true,
          warnings: ["remote_unavailable"],
          dataset: bundled
        };
      }
    }

    if (cacheEntry.status === "valid" && cacheEntry.payload) {
      return {
        source: "cached",
        fetchedAt: cacheEntry.payload.fetchedAt,
        shouldAutoRefresh: false,
        warnings: [],
        dataset: {
          countries: normalizeBundledCountries(cacheEntry.payload.countries),
          airports: normalizeBundledAirports(cacheEntry.payload.airports),
          aircraftTypes: bundled.aircraftTypes
        }
      };
    }

    return {
      source: "bundled",
      fetchedAt: null,
      shouldAutoRefresh: true,
      warnings: [],
      dataset: bundled
    };
  }

  return {
    loadInitialDataset,
    refreshRemote
  };
}
