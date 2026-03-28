import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

const APP_WEB_URL = "https://flatearth-model.com/index.html?app=1";
const ALLOWED_HOSTS = new Set(["flatearth-model.com", "www.flatearth-model.com"]);

const ZOOM_TAP_DELTA = 56;
const ZOOM_HOLD_DELTA = 34;
const ZOOM_HOLD_DELAY_MS = 180;
const ZOOM_HOLD_INTERVAL_MS = 48;

const JOYSTICK_RADIUS = 54;
const JOYSTICK_KNOB_RADIUS = 24;
const JOYSTICK_DEADZONE = 10;
const JOYSTICK_TICK_MS = 16;
const JOYSTICK_MAX_ROTATE_X = 5.8;
const JOYSTICK_MAX_ROTATE_Y = 4.8;
const ZOOM_DOCK_TOP_OFFSET = 92;
const JOYSTICK_LIFT_OFFSET = JOYSTICK_RADIUS * 2;

const WEB_TOUCH_PATCH = `
(function () {
  if (window.__FLAT_EARTH_TOUCH_PATCH__) {
    return;
  }
  window.__FLAT_EARTH_TOUCH_PATCH__ = true;

  function applyPatch() {
    try {
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        );
      }

      if (!document.getElementById("flat-earth-touch-patch-style")) {
        var style = document.createElement("style");
        style.id = "flat-earth-touch-patch-style";
        style.textContent =
          "html, body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; } #scene, canvas { touch-action: none; -webkit-touch-callout: none; }";
        document.head.appendChild(style);
      }

      function shouldBlockGesture(target) {
        if (!(target instanceof Element)) {
          return true;
        }
        if (target.closest("button,a,input,select,textarea,label,[role='button'],[data-ui-interactive]")) {
          return false;
        }
        return Boolean(target.closest("#scene, canvas"));
      }

      document.addEventListener("touchmove", function (event) {
        if (event.touches.length > 1 && shouldBlockGesture(event.target)) {
          event.preventDefault();
        }
      }, { passive: false });

      document.addEventListener("gesturestart", function (event) {
        if (shouldBlockGesture(event.target)) {
          event.preventDefault();
        }
      }, { passive: false });

      document.addEventListener("gesturechange", function (event) {
        if (shouldBlockGesture(event.target)) {
          event.preventDefault();
        }
      }, { passive: false });
    } catch {
      // noop
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPatch, { once: true });
  } else {
    applyPatch();
  }
})();
true;
`;

type CameraCommand =
  | { type: "rotate"; dx: number; dy: number }
  | { type: "zoom"; delta: number }
  | { type: "preset"; preset: "top" | "angle" };

type ZoomDirection = 1 | -1;

function isAllowedNavigation(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url === "about:blank") {
    return true;
  }
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function clampJoystickVector(x: number, y: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= JOYSTICK_RADIUS || magnitude === 0) {
    return { x, y };
  }
  const scale = JOYSTICK_RADIUS / magnitude;
  return { x: x * scale, y: y * scale };
}

function buildCameraCommandScript(command: CameraCommand): string {
  const payload = JSON.stringify(command);
  return `
  (function () {
    try {
      var command = ${payload};
      var bridge = window.__APP_CAMERA_BRIDGE__;
      if (bridge) {
        if (command.type === "rotate" && typeof bridge.rotateBy === "function") {
          bridge.rotateBy(Number(command.dx) || 0, Number(command.dy) || 0);
          return;
        }
        if (command.type === "zoom" && typeof bridge.zoomBy === "function") {
          bridge.zoomBy(Number(command.delta) || 0);
          return;
        }
        if (command.type === "preset" && typeof bridge.setPreset === "function") {
          bridge.setPreset(command.preset === "angle" ? "angle" : "top");
          return;
        }
      }

      var canvas = document.getElementById("scene") || document.querySelector("canvas");
      if (!canvas) {
        return;
      }

      var fallbackState = window.__APP_SYNTH_DRAG_STATE__ || (window.__APP_SYNTH_DRAG_STATE__ = {
        active: false,
        pointerId: 7331,
        x: 0,
        y: 0,
        releaseTimer: null
      });

      function dispatchPointer(type, x, y, buttons) {
        if (typeof PointerEvent !== "function") {
          return;
        }
        canvas.dispatchEvent(new PointerEvent(type, {
          pointerId: fallbackState.pointerId,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          buttons: buttons
        }));
      }

      if (command.type === "zoom") {
        if (typeof WheelEvent === "function") {
          canvas.dispatchEvent(new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: Number(command.delta) || 0
          }));
        }
        return;
      }

      if (command.type === "preset") {
        var toggle = document.getElementById("camera-view-toggle");
        if (toggle && "checked" in toggle) {
          toggle.checked = command.preset === "angle";
          toggle.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      if (command.type !== "rotate") {
        return;
      }

      var rect = canvas.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
        return;
      }

      var minX = rect.left + 8;
      var maxX = rect.right - 8;
      var minY = rect.top + 8;
      var maxY = rect.bottom - 8;

      if (!fallbackState.active) {
        fallbackState.x = rect.left + rect.width * 0.5;
        fallbackState.y = rect.top + rect.height * 0.5;
        dispatchPointer("pointerdown", fallbackState.x, fallbackState.y, 1);
        fallbackState.active = true;
      }

      fallbackState.x = Math.min(Math.max(fallbackState.x + (Number(command.dx) || 0), minX), maxX);
      fallbackState.y = Math.min(Math.max(fallbackState.y + (Number(command.dy) || 0), minY), maxY);
      dispatchPointer("pointermove", fallbackState.x, fallbackState.y, 1);

      if (fallbackState.releaseTimer) {
        clearTimeout(fallbackState.releaseTimer);
      }
      fallbackState.releaseTimer = setTimeout(function () {
        dispatchPointer("pointerup", fallbackState.x, fallbackState.y, 0);
        fallbackState.active = false;
      }, 62);
    } catch {
      // noop
    }
  })();
  true;
  `;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [webKey, setWebKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isWebReady, setIsWebReady] = useState(false);
  const [joystickOffset, setJoystickOffset] = useState({ x: 0, y: 0 });

  const isControlsEnabled = !hasError && isWebReady;
  const controlsEnabledRef = useRef(isControlsEnabled);
  const commandRef = useRef<(command: CameraCommand) => void>(() => undefined);
  const joystickVectorRef = useRef({ x: 0, y: 0 });
  const joystickLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomIsRepeatingRef = useRef(false);

  const dispatchCameraCommand = useCallback((command: CameraCommand) => {
    if (!controlsEnabledRef.current) {
      return;
    }
    webViewRef.current?.injectJavaScript(buildCameraCommandScript(command));
  }, []);

  const clearZoomTimers = useCallback(() => {
    if (zoomStartTimerRef.current) {
      clearTimeout(zoomStartTimerRef.current);
      zoomStartTimerRef.current = null;
    }
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  }, []);

  const stopJoystickLoop = useCallback(() => {
    if (joystickLoopRef.current) {
      clearInterval(joystickLoopRef.current);
      joystickLoopRef.current = null;
    }
  }, []);

  const releaseJoystick = useCallback(() => {
    joystickVectorRef.current = { x: 0, y: 0 };
    setJoystickOffset({ x: 0, y: 0 });
    stopJoystickLoop();
  }, [stopJoystickLoop]);

  const startJoystickLoop = useCallback(() => {
    if (joystickLoopRef.current) {
      return;
    }
    joystickLoopRef.current = setInterval(() => {
      if (!controlsEnabledRef.current) {
        return;
      }

      const vector = joystickVectorRef.current;
      const magnitude = Math.hypot(vector.x, vector.y);
      if (magnitude < JOYSTICK_DEADZONE) {
        return;
      }

      const normalizedX = vector.x / JOYSTICK_RADIUS;
      const normalizedY = vector.y / JOYSTICK_RADIUS;
      const strength = Math.min(
        Math.max((magnitude - JOYSTICK_DEADZONE) / (JOYSTICK_RADIUS - JOYSTICK_DEADZONE), 0),
        1
      );
      const response = 0.35 + (0.65 * strength);

      commandRef.current({
        type: "rotate",
        dx: normalizedX * JOYSTICK_MAX_ROTATE_X * response,
        dy: normalizedY * JOYSTICK_MAX_ROTATE_Y * response
      });
    }, JOYSTICK_TICK_MS);
  }, []);

  const updateJoystick = useCallback((dx: number, dy: number) => {
    const clamped = clampJoystickVector(dx, dy);
    joystickVectorRef.current = clamped;
    setJoystickOffset(clamped);
  }, []);

  const beginZoomHold = useCallback((direction: ZoomDirection) => {
    if (!controlsEnabledRef.current) {
      return;
    }

    clearZoomTimers();
    zoomIsRepeatingRef.current = false;
    zoomStartTimerRef.current = setTimeout(() => {
      if (!controlsEnabledRef.current) {
        return;
      }
      zoomIsRepeatingRef.current = true;
      commandRef.current({
        type: "zoom",
        delta: direction * ZOOM_HOLD_DELTA
      });
      zoomIntervalRef.current = setInterval(() => {
        commandRef.current({
          type: "zoom",
          delta: direction * ZOOM_HOLD_DELTA
        });
      }, ZOOM_HOLD_INTERVAL_MS);
    }, ZOOM_HOLD_DELAY_MS);
  }, [clearZoomTimers]);

  const endZoomHold = useCallback((direction: ZoomDirection) => {
    const wasRepeating = zoomIsRepeatingRef.current;
    zoomIsRepeatingRef.current = false;
    clearZoomTimers();
    if (!controlsEnabledRef.current) {
      return;
    }
    if (!wasRepeating) {
      commandRef.current({
        type: "zoom",
        delta: direction * ZOOM_TAP_DELTA
      });
    }
  }, [clearZoomTimers]);

  useEffect(() => {
    controlsEnabledRef.current = isControlsEnabled;
    if (!isControlsEnabled) {
      clearZoomTimers();
      zoomIsRepeatingRef.current = false;
      releaseJoystick();
    }
  }, [clearZoomTimers, isControlsEnabled, releaseJoystick]);

  useEffect(() => {
    commandRef.current = dispatchCameraCommand;
  }, [dispatchCameraCommand]);

  useEffect(() => {
    return () => {
      clearZoomTimers();
      stopJoystickLoop();
    };
  }, [clearZoomTimers, stopJoystickLoop]);

  const joystickPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => controlsEnabledRef.current,
    onMoveShouldSetPanResponder: (_event, gestureState) => controlsEnabledRef.current
      && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
    onPanResponderGrant: () => {
      if (!controlsEnabledRef.current) {
        return;
      }
      startJoystickLoop();
      updateJoystick(0, 0);
    },
    onPanResponderMove: (_event, gestureState) => {
      if (!controlsEnabledRef.current) {
        return;
      }
      updateJoystick(gestureState.dx, gestureState.dy);
    },
    onPanResponderRelease: () => {
      releaseJoystick();
    },
    onPanResponderTerminate: () => {
      releaseJoystick();
    },
    onPanResponderTerminationRequest: () => true
  }), [releaseJoystick, startJoystickLoop, updateJoystick]);

  const handleBackPress = useCallback(() => {
    if (hasError) {
      return false;
    }
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    return false;
  }, [canGoBack, hasError]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  const handleNavigationChange = useCallback((navigationState: WebViewNavigation) => {
    setCanGoBack(navigationState.canGoBack);
  }, []);

  const handleShouldStart = useCallback((request: { url: string }) => {
    const { url } = request;
    if (isAllowedNavigation(url)) {
      return true;
    }
    Linking.openURL(url).catch(() => undefined);
    return false;
  }, []);

  const reload = useCallback(() => {
    setHasError(false);
    setCanGoBack(false);
    setIsWebReady(false);
    setWebKey((value) => value + 1);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load web app</Text>
          <Text style={styles.errorText}>Check your network connection and try again.</Text>
          <Pressable onPress={reload} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WebView
            key={webKey}
            ref={webViewRef}
            source={{ uri: APP_WEB_URL }}
            style={styles.webView}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={WEB_TOUCH_PATCH}
            allowsBackForwardNavigationGestures={false}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#d7e8ff" />
                <Text style={styles.loadingText}>Loading viewer...</Text>
              </View>
            )}
            onNavigationStateChange={handleNavigationChange}
            onShouldStartLoadWithRequest={handleShouldStart}
            onLoadStart={() => {
              setIsWebReady(false);
            }}
            onLoadEnd={() => {
              setIsWebReady(true);
            }}
            onError={() => {
              setHasError(true);
              setIsWebReady(false);
            }}
            onHttpError={() => {
              setHasError(true);
              setIsWebReady(false);
            }}
          />
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <View style={styles.zoomDock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                disabled={!isControlsEnabled}
                onPressIn={() => beginZoomHold(-1)}
                onPressOut={() => endZoomHold(-1)}
                style={({ pressed }) => [
                  styles.controlButton,
                  pressed && isControlsEnabled ? styles.controlButtonPressed : null,
                  !isControlsEnabled ? styles.controlDisabled : null
                ]}
              >
                <Text style={styles.controlText}>+</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                disabled={!isControlsEnabled}
                onPressIn={() => beginZoomHold(1)}
                onPressOut={() => endZoomHold(1)}
                style={({ pressed }) => [
                  styles.controlButton,
                  pressed && isControlsEnabled ? styles.controlButtonPressed : null,
                  !isControlsEnabled ? styles.controlDisabled : null
                ]}
              >
                <Text style={styles.controlText}>-</Text>
              </Pressable>
            </View>
            <View style={styles.joystickDock}>
              <View
                style={[
                  styles.joystickPad,
                  !isControlsEnabled ? styles.controlDisabled : null
                ]}
                {...joystickPanResponder.panHandlers}
              >
                <View
                  style={[
                    styles.joystickKnob,
                    {
                      transform: [
                        { translateX: joystickOffset.x },
                        { translateY: joystickOffset.y }
                      ]
                    }
                  ]}
                />
              </View>
              <Text style={styles.joystickHint}>ROTATE</Text>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#040711"
  },
  webView: {
    flex: 1,
    backgroundColor: "#040711"
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#040711",
    gap: 10
  },
  loadingText: {
    color: "#d7e8ff",
    fontSize: 14
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#040711",
    gap: 10
  },
  errorTitle: {
    color: "#e9f2ff",
    fontSize: 18,
    fontWeight: "700"
  },
  errorText: {
    color: "#9cb2d1",
    fontSize: 14,
    textAlign: "center"
  },
  retryButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#5b7598",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#13243a"
  },
  retryText: {
    color: "#d7e8ff",
    fontWeight: "600"
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none"
  },
  zoomDock: {
    position: "absolute",
    left: 16,
    top: ZOOM_DOCK_TOP_OFFSET,
    gap: 10
  },
  controlButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(192, 224, 255, 0.65)",
    backgroundColor: "rgba(5, 13, 28, 0.74)"
  },
  controlButtonPressed: {
    backgroundColor: "rgba(35, 80, 128, 0.85)"
  },
  controlText: {
    color: "#e7f5ff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 28
  },
  joystickDock: {
    position: "absolute",
    right: 16,
    bottom: 16 + JOYSTICK_LIFT_OFFSET,
    alignItems: "center",
    gap: 6
  },
  joystickPad: {
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: JOYSTICK_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(188, 228, 255, 0.52)",
    backgroundColor: "rgba(8, 16, 34, 0.68)",
    alignItems: "center",
    justifyContent: "center"
  },
  joystickKnob: {
    width: JOYSTICK_KNOB_RADIUS * 2,
    height: JOYSTICK_KNOB_RADIUS * 2,
    borderRadius: JOYSTICK_KNOB_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(232, 247, 255, 0.9)",
    backgroundColor: "rgba(96, 176, 234, 0.85)"
  },
  joystickHint: {
    color: "rgba(214, 236, 255, 0.85)",
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700"
  },
  controlDisabled: {
    opacity: 0.38
  }
});
