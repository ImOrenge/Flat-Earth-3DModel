import { describe, expect, it } from "vitest";
import {
  advanceSimulation,
  computeCelestialPositions,
  createSimulationState,
  getHudState
} from "../src";

describe("computeCelestialPositions", () => {
  it("keeps solar latitude near zero around March equinox", () => {
    const snapshot = computeCelestialPositions("2026-03-20T12:00:00.000Z");
    expect(Math.abs(snapshot.sun.latitudeDegrees)).toBeLessThan(1.5);
  });

  it("keeps solar latitude near tropic value around June solstice", () => {
    const snapshot = computeCelestialPositions("2026-06-21T12:00:00.000Z");
    expect(snapshot.sun.latitudeDegrees).toBeGreaterThan(20);
    expect(snapshot.sun.latitudeDegrees).toBeLessThan(24.5);
  });
});

describe("simulation state", () => {
  it("initializes with live mode by default", () => {
    const state = createSimulationState();
    expect(state.config.timeMode).toBe("live");
    expect(state.celestial.timestampMs).toBeGreaterThan(0);
  });

  it("advances manual time when live mode is disabled", () => {
    const state = createSimulationState({
      timeMode: "manual",
      manualObservationTime: "2026-03-28T00:00:00.000Z"
    });
    const next = advanceSimulation(state, 120, { appActive: true });
    expect(next.currentObservationTimeMs - state.currentObservationTimeMs).toBe(120_000);
  });

  it("produces HUD snapshot", () => {
    const state = createSimulationState();
    const hud = getHudState(state);
    expect(hud.timeLabel.length).toBeGreaterThan(5);
    expect(hud.solarLatitudeLabel).toContain("deg");
  });
});
