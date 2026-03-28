import type { DetailAction, DetailSnapshot, HudState, TimeMode } from "@flat-earth/core-sim";
import { AppState, type AppStateStatus, PixelRatio, type LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailSheet } from "./components/DetailSheet";
import { HelpModal } from "./components/HelpModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { WebTopbar } from "./components/WebTopbar";
import { createMobileFeatureRuntimeConfig } from "./data/featureRuntimeConfig";
import { FlatEarthEngineBridge } from "./engine/FlatEarthEngineBridge";
import { palette } from "./theme";

const HUD_UPDATE_INTERVAL_MS = 180;
const DETAIL_UPDATE_INTERVAL_MS = 260;

const INITIAL_HUD: HudState = {
  timeLabel: "--",
  solarLatitudeLabel: "--",
  seasonStateLabel: "--",
  systemLabel: "Initializing",
  observationTimeMs: Date.now(),
  timeMode: "live",
  qualityLevel: "auto"
};

const INITIAL_DETAIL: DetailSnapshot = {
  activeTab: "astronomy",
  astronomy: {
    eclipse: {
      sourceLabel: "Loading",
      kind: "solar",
      selectedYear: null,
      selectedEventId: null,
      selectedEventIndex: -1,
      timePoint: "peak",
      availableYears: [],
      eventOptions: [],
      stageLabel: "Waiting",
      coveragePercent: 0,
      lightPercent: 100,
      summary: "Loading detail data...",
      selectedEventLabel: "-",
      selectedEventLocalTimeLabel: "-",
      selectedEventUtcTimeLabel: "-",
      selectedEventMagnitudeLabel: "-",
      previewTimeMs: null
    }
  },
  constellations: {
    visible: true,
    linesVisible: true,
    options: [],
    selectedIndex: -1,
    selectedName: "",
    selectedCode: "",
    directionLabel: "-",
    centerRaLabel: "-",
    centerDecLabel: "-",
    hemisphereLabel: "-",
    segmentCount: 0,
    starCount: 0,
    zodiacSignLabel: "-"
  },
  routes: {
    ready: false,
    playing: false,
    speedMultiplier: 8,
    selectedRouteId: "",
    selectedRouteIndex: -1,
    routeOptions: [],
    progressRatio: 0,
    progressPercent: 0,
    legLabel: "-",
    aircraftLabel: "-",
    originLabel: "-",
    destinationLabel: "-",
    countriesLabel: "-",
    durationLabel: "-",
    routeProgressLabel: "-",
    geoSummaryLabel: "-",
    summary: "Loading detail data...",
    renderData: null
  },
  rockets: {
    backend: "fallback",
    selectedSpaceportId: "",
    selectedSpaceportIndex: -1,
    spaceportOptions: [],
    rocketType: "two-stage",
    phase: "idle",
    missionElapsedSeconds: 0,
    phaseElapsedSeconds: 0,
    canLaunch: true,
    telemetry: {
      phase: "idle",
      elapsedSeconds: 0,
      altitudeKm: 0,
      speedKps: 0,
      downrangeKm: 0,
      statusLabel: "Ready"
    },
    renderData: {
      latitudeDegrees: 0,
      longitudeDegrees: 0,
      altitudeKm: 0
    }
  }
};

function getTouchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) {
    return 0;
  }
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

export function AppRoot() {
  const insets = useSafeAreaInsets();
  const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [detail, setDetail] = useState<DetailSnapshot>(INITIAL_DETAIL);
  const [fpsEstimate, setFpsEstimate] = useState(45);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const bridgeRef = useRef<FlatEarthEngineBridge | null>(null);
  const glReadyRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastHudUpdateAtRef = useRef(0);
  const lastDetailUpdateAtRef = useRef(0);
  const activeDetailTabRef = useRef<DetailSnapshot["activeTab"]>(INITIAL_DETAIL.activeTab);
  const lastTapAtRef = useRef(0);
  const deltaRef = useRef({ dx: 0, dy: 0, pinch: 0 });

  const stopLoop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const updateOverlaySnapshots = useCallback((timeMs: number) => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    if ((timeMs - lastHudUpdateAtRef.current) >= HUD_UPDATE_INTERVAL_MS) {
      const hudSnapshot = bridge.getHudSnapshot();
      setHud(hudSnapshot);
      lastHudUpdateAtRef.current = timeMs;
    }
    if ((timeMs - lastDetailUpdateAtRef.current) >= DETAIL_UPDATE_INTERVAL_MS) {
      const detailSnapshot = bridge.getDetailSnapshot(activeDetailTabRef.current);
      activeDetailTabRef.current = detailSnapshot.activeTab;
      setDetail(detailSnapshot);
      lastDetailUpdateAtRef.current = timeMs;
    }
  }, []);

  const renderLoop = useCallback((timeMs: number) => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    if (lastFrameTimeRef.current !== null) {
      const dtMs = Math.max(1, timeMs - lastFrameTimeRef.current);
      const nextFps = Math.min(120, 1000 / dtMs);
      setFpsEstimate((previous) => (previous * 0.85) + (nextFps * 0.15));
    }
    lastFrameTimeRef.current = timeMs;
    bridge.tick(timeMs);
    updateOverlaySnapshots(timeMs);
    animationRef.current = requestAnimationFrame(renderLoop);
  }, [updateOverlaySnapshots]);

  const startLoop = useCallback(() => {
    if (animationRef.current !== null) {
      return;
    }
    lastFrameTimeRef.current = null;
    animationRef.current = requestAnimationFrame(renderLoop);
  }, [renderLoop]);

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    if (glReadyRef.current) {
      return;
    }
    glReadyRef.current = true;
    const bridge = new FlatEarthEngineBridge(createMobileFeatureRuntimeConfig());
    bridgeRef.current = bridge;
    await bridge.init({
      gl,
      width: Math.max(1, surfaceSize.width),
      height: Math.max(1, surfaceSize.height),
      pixelRatio: PixelRatio.get()
    });
    bridge.setAppActive(appStateRef.current === "active");
    setHud(bridge.getHudSnapshot());
    const detailSnapshot = bridge.getDetailSnapshot(activeDetailTabRef.current);
    activeDetailTabRef.current = detailSnapshot.activeTab;
    setDetail(detailSnapshot);
    startLoop();
  }, [startLoop, surfaceSize.height, surfaceSize.width]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (bridge) {
      bridge.resize(surfaceSize.width, surfaceSize.height, PixelRatio.get());
    }
  }, [surfaceSize]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      const active = nextState === "active";
      bridgeRef.current?.setAppActive(active);
      if (active) {
        startLoop();
      } else {
        setSettingsOpen(false);
        setHelpOpen(false);
        stopLoop();
      }
    });
    return () => subscription.remove();
  }, [startLoop, stopLoop]);

  useEffect(() => () => {
    stopLoop();
    bridgeRef.current?.dispose();
    bridgeRef.current = null;
  }, [stopLoop]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        deltaRef.current = {
          dx: 0,
          dy: 0,
          pinch: getTouchDistance(event.nativeEvent.touches)
        };
      },
      onPanResponderMove: (event, gestureState) => {
        const bridge = bridgeRef.current;
        if (!bridge) {
          return;
        }
        if (gestureState.numberActiveTouches >= 2) {
          const currentDistance = getTouchDistance(event.nativeEvent.touches);
          if (deltaRef.current.pinch > 0 && currentDistance > 0) {
            bridge.setCameraGesture({
              type: "pinch",
              scale: currentDistance / deltaRef.current.pinch
            });
          }
          deltaRef.current.pinch = currentDistance;
          return;
        }
        const nextDx = gestureState.dx;
        const nextDy = gestureState.dy;
        const deltaX = nextDx - deltaRef.current.dx;
        const deltaY = nextDy - deltaRef.current.dy;
        deltaRef.current.dx = nextDx;
        deltaRef.current.dy = nextDy;
        bridge.setCameraGesture({
          type: "rotate",
          deltaX,
          deltaY
        });
      },
      onPanResponderRelease: (_event, gestureState) => {
        const bridge = bridgeRef.current;
        if (!bridge) {
          return;
        }
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          const now = Date.now();
          if (now - lastTapAtRef.current < 280) {
            bridge.setCameraGesture({ type: "reset" });
          }
          lastTapAtRef.current = now;
        }
      }
    }),
    []
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSurfaceSize({
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    });
  }, []);

  const handleToggleMode = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    const currentMode: TimeMode = hud.timeMode;
    const nextMode: TimeMode = currentMode === "live" ? "manual" : "live";
    bridge.setTimeMode(nextMode);
    if (nextMode === "manual") {
      const targetMs = Number.isFinite(hud.observationTimeMs) ? hud.observationTimeMs : Date.now();
      bridge.setObservationTime(targetMs);
    }
    setHud((previous) => ({
      ...previous,
      timeMode: nextMode,
      systemLabel: "Applying time mode..."
    }));
  }, [hud.observationTimeMs, hud.timeMode]);

  const adjustManualHours = useCallback((offsetHours: number) => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    const currentMs = Number.isFinite(hud.observationTimeMs) ? hud.observationTimeMs : Date.now();
    const nextObservationMs = currentMs + (offsetHours * 60 * 60 * 1000);
    bridge.setObservationTime(nextObservationMs);
    setHud((previous) => ({
      ...previous,
      observationTimeMs: nextObservationMs,
      timeMode: "manual",
      timeLabel: new Date(nextObservationMs).toISOString().replace("T", " ").slice(0, 16)
    }));
  }, [hud.observationTimeMs]);

  const setNow = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    const nowMs = Date.now();
    bridge.setObservationTime(nowMs);
    if (hud.timeMode === "live") {
      bridge.setTimeMode("live");
    }
    setHud((previous) => ({
      ...previous,
      observationTimeMs: nowMs,
      timeLabel: new Date(nowMs).toISOString().replace("T", " ").slice(0, 16)
    }));
  }, [hud.timeMode]);

  const handleDetailAction = useCallback((action: DetailAction) => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    bridge.dispatchDetailAction(action);
    if (action.type === "set_active_tab") {
      activeDetailTabRef.current = action.tab;
    }
    const detailSnapshot = bridge.getDetailSnapshot(activeDetailTabRef.current);
    activeDetailTabRef.current = detailSnapshot.activeTab;
    setDetail(detailSnapshot);
    setHud(bridge.getHudSnapshot());
  }, []);

  const handleOpenSettings = useCallback(() => {
    setHelpOpen(false);
    setSettingsOpen(true);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setSettingsOpen(false);
    setHelpOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  return (
    <View style={styles.screen} onLayout={handleLayout}>
      <GLView style={styles.gl} onContextCreate={handleContextCreate} />
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      <WebTopbar
        fpsEstimate={fpsEstimate}
        hud={hud}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        topInset={insets.top}
      />
      <SettingsPanel
        hud={hud}
        onClose={handleCloseSettings}
        onSetNow={setNow}
        onShiftManualHour={adjustManualHours}
        onToggleTimeMode={handleToggleMode}
        topInset={insets.top}
        visible={settingsOpen}
      />
      <DetailSheet
        bottomInset={insets.bottom}
        onAction={handleDetailAction}
        snapshot={detail}
      />
      <HelpModal onClose={handleCloseHelp} visible={helpOpen} />
      {!glReadyRef.current && (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Preparing native GL scene...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background
  },
  gl: {
    flex: 1
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    color: palette.subtleText,
    fontWeight: "600"
  }
});
