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
    expect(hud.seasonStateLabel.length).toBeGreaterThan(3);
    expect(hud.observationTimeMs).toBe(state.currentObservationTimeMs);
  });

  it("keeps HUD labels stable for a fixed manual timestamp", () => {
    const state = createSimulationState({
      timeMode: "manual",
      manualObservationTime: "2026-06-21T12:00:00.000Z"
    });
    const first = getHudState(state);
    const second = getHudState(state);
    expect(first.solarLatitudeLabel).toBe(second.solarLatitudeLabel);
    expect(first.seasonStateLabel).toBe(second.seasonStateLabel);
    expect(first.seasonStateLabel).toBe("Northern summer / Southern winter");
    expect(first.observationTimeMs).toBe(second.observationTimeMs);
  });

  it("updates HUD observation time across manual and live transitions", () => {
    const state = createSimulationState({
      timeMode: "manual",
      manualObservationTime: "2026-03-28T00:00:00.000Z"
    });
    const manualAdvanced = advanceSimulation(state, 3600, { appActive: true });
    const manualHud = getHudState(manualAdvanced);
    expect(manualHud.observationTimeMs - state.currentObservationTimeMs).toBe(3_600_000);

    const liveState = {
      ...manualAdvanced,
      config: {
        ...manualAdvanced.config,
        timeMode: "live" as const
      }
    };
    const liveNowMs = Date.parse("2026-03-28T09:15:00.000Z");
    const liveAdvanced = advanceSimulation(liveState, 0, { appActive: true, nowMs: liveNowMs });
    const liveHud = getHudState(liveAdvanced);
    expect(liveHud.observationTimeMs).toBe(liveNowMs);
  });
});
