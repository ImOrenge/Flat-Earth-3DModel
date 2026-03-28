import type {
  ConstellationEntry,
  EclipseEvent,
  FeatureRuntimeConfig,
  RouteAircraftType,
  RouteAirport,
  RouteCountry,
  RouteDefinition
} from "@flat-earth/core-sim";

const solarEvents = require("../../assets/data/eclipse-solar-events.json") as EclipseEvent[];
const lunarEvents = require("../../assets/data/eclipse-lunar-events.json") as EclipseEvent[];
const constellations = require("../../assets/data/constellation-data-flat-earth.json") as ConstellationEntry[];
const countries = require("../../assets/data/countries.json") as RouteCountry[];
const airports = require("../../assets/data/airports.json") as RouteAirport[];
const aircraftTypes = require("../../assets/data/aircraft-types.json") as RouteAircraftType[];
const routes = require("../../assets/data/routes.json") as RouteDefinition[];

export function createMobileFeatureRuntimeConfig(): FeatureRuntimeConfig {
  return {
    eclipse: {
      sourceLabel: "Bundled NASA catalog",
      solarEvents,
      lunarEvents
    },
    constellations: {
      entries: constellations
    },
    routes: {
      countries,
      airports,
      aircraftTypes,
      routes
    },
    rockets: {
      backend: "fallback"
    }
  };
}
