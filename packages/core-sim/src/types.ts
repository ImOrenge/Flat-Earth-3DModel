export type TimeMode = "live" | "manual";
export type QualityLevel = "auto" | "high" | "medium" | "low";

export interface SimulationConfig {
  timeMode?: TimeMode;
  qualityLevel?: QualityLevel;
  gestureSensitivity?: number;
  observerLatitudeDegrees?: number;
  observerLongitudeDegrees?: number;
  manualObservationTime?: Date | number | string;
}

export interface CameraState {
  azimuthRadians: number;
  elevationRadians: number;
  radius: number;
}

export interface CameraGestureInput {
  type: "rotate" | "pinch" | "reset";
  deltaX?: number;
  deltaY?: number;
  scale?: number;
}

export interface CelestialBodySnapshot {
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeFactor: number;
  orbitRadians: number;
  phaseProgress?: number;
}

export interface CelestialSnapshot {
  timestampMs: number;
  timestampIso: string;
  sun: CelestialBodySnapshot;
  moon: CelestialBodySnapshot;
  seasonalEclipticAngleRadians: number;
  solarAltitudeFactor: number;
}

export interface SimulationState {
  config: {
    timeMode: TimeMode;
    qualityLevel: QualityLevel;
    gestureSensitivity: number;
    observerLatitudeDegrees: number;
    observerLongitudeDegrees: number;
  };
  camera: CameraState;
  manualObservationTimeMs: number;
  currentObservationTimeMs: number;
  appActive: boolean;
  celestial: CelestialSnapshot;
}

export interface AdvanceContext {
  observationTime?: Date | number | string;
  appActive?: boolean;
  nowMs?: number;
}

export interface HudState {
  timeLabel: string;
  solarLatitudeLabel: string;
  seasonStateLabel: string;
  systemLabel: string;
  observationTimeMs: number;
  timeMode: TimeMode;
  qualityLevel: QualityLevel;
}

export interface ComputeCelestialParams {
  observerLatitudeDegrees?: number;
  observerLongitudeDegrees?: number;
}

export type DetailTab = "astronomy" | "routes" | "constellations" | "rockets";
export type EclipseKind = "solar" | "lunar";
export type EclipseTimePoint = "start" | "peak" | "end";
export type RocketType = "two-stage" | "single";
export type RocketLaunchPhase = "idle" | "stage1" | "separation" | "stage2" | "coast" | "complete";
export type RocketPhysicsBackend = "rapier" | "fallback";

export interface EclipseEvent {
  id: string;
  kind: EclipseKind;
  type: string;
  startMs: number;
  peakMs: number;
  endMs: number;
  magnitude: number | null;
  gamma: number | null;
  sourceId: string;
  year: number;
}

export interface EclipseEventOption {
  id: string;
  label: string;
  type: string;
  peakMs: number;
  magnitude: number | null;
}

export interface EclipseDetailState {
  sourceLabel: string;
  kind: EclipseKind;
  selectedYear: number | null;
  selectedEventId: string | null;
  selectedEventIndex: number;
  timePoint: EclipseTimePoint;
  availableYears: number[];
  eventOptions: EclipseEventOption[];
  stageLabel: string;
  coveragePercent: number;
  lightPercent: number;
  summary: string;
  selectedEventLabel: string;
  selectedEventLocalTimeLabel: string;
  selectedEventUtcTimeLabel: string;
  selectedEventMagnitudeLabel: string;
  previewTimeMs: number | null;
}

export interface ConstellationEntry {
  name: string;
  code: string;
  segmentCount: number;
  uniqueStarCount: number;
  centroidRAHours: number;
  centroidDecDeg: number;
  minDecDeg: number;
  maxDecDeg: number;
  segments: number[][][];
}

export interface ConstellationOption {
  name: string;
  code: string;
}

export interface ConstellationDetailState {
  visible: boolean;
  linesVisible: boolean;
  options: ConstellationOption[];
  selectedIndex: number;
  selectedName: string;
  selectedCode: string;
  directionLabel: string;
  centerRaLabel: string;
  centerDecLabel: string;
  hemisphereLabel: string;
  segmentCount: number;
  starCount: number;
  zodiacSignLabel: string;
}

export interface RouteCountry {
  alpha2: string;
  alpha3: string;
  numeric: string;
  name: string;
  region: string;
}

export interface RouteAirport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface RouteAircraftType {
  icaoCode: string;
  iataCode: string;
  name: string;
  category: string;
}

export interface RouteDefinition {
  id: string;
  originIcao: string;
  destinationIcao: string;
  aircraftTypeCode: string;
  callsign: string;
  durationHours: number;
  cruiseSpeedKts: number;
  cruiseAltitudeFt: number;
}

export interface RouteOption {
  id: string;
  label: string;
}

export interface RouteRenderData {
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
}

export interface RouteDetailState {
  ready: boolean;
  playing: boolean;
  speedMultiplier: number;
  selectedRouteId: string;
  selectedRouteIndex: number;
  routeOptions: RouteOption[];
  progressRatio: number;
  progressPercent: number;
  legLabel: string;
  aircraftLabel: string;
  originLabel: string;
  destinationLabel: string;
  countriesLabel: string;
  durationLabel: string;
  routeProgressLabel: string;
  geoSummaryLabel: string;
  summary: string;
  renderData: RouteRenderData | null;
}

export interface RocketSpaceport {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  headingDegrees: number;
}

export interface RocketTelemetry {
  phase: RocketLaunchPhase;
  elapsedSeconds: number;
  altitudeKm: number;
  speedKps: number;
  downrangeKm: number;
  statusLabel: string;
}

export interface RocketDetailState {
  backend: RocketPhysicsBackend;
  selectedSpaceportId: string;
  selectedSpaceportIndex: number;
  spaceportOptions: RocketSpaceport[];
  rocketType: RocketType;
  phase: RocketLaunchPhase;
  missionElapsedSeconds: number;
  phaseElapsedSeconds: number;
  canLaunch: boolean;
  telemetry: RocketTelemetry;
  renderData: {
    latitudeDegrees: number;
    longitudeDegrees: number;
    altitudeKm: number;
  };
}

export interface DetailSnapshot {
  activeTab: DetailTab;
  astronomy: {
    eclipse: EclipseDetailState;
  };
  constellations: ConstellationDetailState;
  routes: RouteDetailState;
  rockets: RocketDetailState;
}

export interface FeatureRuntimeState {
  activeTab: DetailTab;
  observationTimeMs: number;
  pendingObservationTimeMs: number | null;
  appActive: boolean;
  eclipse: EclipseDetailState;
  constellations: ConstellationDetailState;
  routes: RouteDetailState;
  rockets: RocketDetailState;
  data: {
    eclipseSolarEvents: EclipseEvent[];
    eclipseLunarEvents: EclipseEvent[];
    constellations: ConstellationEntry[];
    countriesByCode: Record<string, RouteCountry>;
    airportsByIcao: Record<string, RouteAirport>;
    aircraftByCode: Record<string, RouteAircraftType>;
    routesById: Record<string, RouteDefinition>;
  };
}

export type DetailAction =
  | { type: "set_active_tab"; tab: DetailTab }
  | { type: "eclipse_set_kind"; kind: EclipseKind }
  | { type: "eclipse_set_year"; year: number }
  | { type: "eclipse_set_event"; eventId: string }
  | { type: "eclipse_set_timepoint"; timePoint: EclipseTimePoint }
  | { type: "eclipse_preview_selected" }
  | { type: "constellation_toggle_visibility"; visible: boolean }
  | { type: "constellation_toggle_lines"; visible: boolean }
  | { type: "constellation_select"; name: string }
  | { type: "routes_select"; routeId: string }
  | { type: "routes_set_speed"; speedMultiplier: number }
  | { type: "routes_toggle_playback"; playing?: boolean }
  | { type: "routes_reset" }
  | { type: "rockets_select_spaceport"; spaceportId: string }
  | { type: "rockets_select_type"; rocketType: RocketType }
  | { type: "rockets_launch" }
  | { type: "rockets_reset" };

export interface FeatureRuntimeConfig {
  eclipse?: {
    sourceLabel?: string;
    solarEvents?: EclipseEvent[];
    lunarEvents?: EclipseEvent[];
  };
  constellations?: {
    entries?: ConstellationEntry[];
  };
  routes?: {
    countries?: RouteCountry[];
    airports?: RouteAirport[];
    aircraftTypes?: RouteAircraftType[];
    routes?: RouteDefinition[];
  };
  rockets?: {
    spaceports?: RocketSpaceport[];
    backend?: RocketPhysicsBackend;
  };
}

export interface FeatureAdvanceContext {
  observationTimeMs: number;
  appActive?: boolean;
  seasonalEclipticAngleRadians?: number;
}
