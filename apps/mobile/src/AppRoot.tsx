import type { HudState, TimeMode } from "@flat-earth/core-sim";
import { AppState, type AppStateStatus, PixelRatio, type LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlBar } from "./components/ControlBar";
import { HudOverlay } from "./components/HudOverlay";
import { FlatEarthEngineBridge } from "./engine/FlatEarthEngineBridge";
import { palette } from "./theme";

const HUD_UPDATE_INTERVAL_MS = 180;

const INITIAL_HUD: HudState = {
  timeLabel: "--",
  solarLatitudeLabel: "--",
  systemLabel: "Initializing",
  timeMode: "live",
  qualityLevel: "auto"
};

function getTouchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) {
    return 0;
  }
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

export function AppRoot() {
  const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [fpsEstimate, setFpsEstimate] = useState(45);
  const [timeMode, setTimeMode] = useState<TimeMode>("live");

  const bridgeRef = useRef<FlatEarthEngineBridge | null>(null);
  const glReadyRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastHudUpdateAtRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const deltaRef = useRef({ dx: 0, dy: 0, pinch: 0 });

  const stopLoop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const updateHud = useCallback((timeMs: number) => {
    const bridge = bridgeRef.current;
    if (!bridge || (timeMs - lastHudUpdateAtRef.current) < HUD_UPDATE_INTERVAL_MS) {
      return;
    }
    const snapshot = bridge.getHudSnapshot();
    setHud(snapshot);
    setTimeMode(snapshot.timeMode);
    lastHudUpdateAtRef.current = timeMs;
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
    updateHud(timeMs);
    animationRef.current = requestAnimationFrame(renderLoop);
  }, [updateHud]);

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
    const bridge = new FlatEarthEngineBridge();
    bridgeRef.current = bridge;
    await bridge.init({
      gl,
      width: Math.max(1, surfaceSize.width),
      height: Math.max(1, surfaceSize.height),
      pixelRatio: PixelRatio.get()
    });
    bridge.setAppActive(appStateRef.current === "active");
    setHud(bridge.getHudSnapshot());
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
    const nextMode: TimeMode = timeMode === "live" ? "manual" : "live";
    bridge.setTimeMode(nextMode);
    if (nextMode === "manual") {
      bridge.setObservationTime(Date.now());
    }
    setTimeMode(nextMode);
  }, [timeMode]);

  const adjustManualHours = useCallback((offsetHours: number) => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    const baseMs = Date.parse(hud.timeLabel.replace(" ", "T") + ":00.000Z");
    const fallbackMs = Date.now();
    const currentMs = Number.isNaN(baseMs) ? fallbackMs : baseMs;
    bridge.setObservationTime(currentMs + (offsetHours * 60 * 60 * 1000));
  }, [hud.timeLabel]);

  const setNow = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    bridge.setObservationTime(Date.now());
    if (timeMode === "live") {
      bridge.setTimeMode("live");
    }
  }, [timeMode]);

  return (
    <View style={styles.screen} onLayout={handleLayout}>
      <GLView style={styles.gl} onContextCreate={handleContextCreate} />
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      <HudOverlay hud={hud} fpsEstimate={fpsEstimate} />
      <ControlBar
        timeMode={timeMode}
        onToggleMode={handleToggleMode}
        onManualBackHour={() => adjustManualHours(-1)}
        onManualForwardHour={() => adjustManualHours(1)}
        onSetNow={setNow}
      />
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
