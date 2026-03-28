import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
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

      var pinchDistance = null;
      var pinchTarget = null;
      var dragTouchId = null;
      var dragTarget = null;
      var dragPointerId = 101;

      function isUiElement(target) {
        if (!(target instanceof Element)) {
          return false;
        }
        return Boolean(target.closest("button, a, input, select, textarea, label, [role='button'], [data-ui-interactive]"));
      }

      function distance(touches) {
        var a = touches[0];
        var b = touches[1];
        return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      }

      function getTouchByIdentifier(touchList, identifier) {
        for (var i = 0; i < touchList.length; i += 1) {
          if (touchList[i].identifier === identifier) {
            return touchList[i];
          }
        }
        return null;
      }

      function getTargetCanvas() {
        return document.getElementById("scene") || document.querySelector("canvas");
      }

      function createWheelEvent(deltaY) {
        try {
          return new WheelEvent("wheel", {
            deltaY: deltaY,
            bubbles: true,
            cancelable: true
          });
        } catch {
          var event = document.createEvent("Event");
          event.initEvent("wheel", true, true);
          event.deltaY = deltaY;
          return event;
        }
      }

      function dispatchPointerFromTouch(type, touch, target) {
        if (!target || !touch) {
          return;
        }

        var baseEvent = {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          screenX: touch.screenX,
          screenY: touch.screenY
        };

        if (window.PointerEvent) {
          var pointerEvent = new PointerEvent(type, Object.assign({}, baseEvent, {
            pointerId: dragPointerId,
            pointerType: "touch",
            isPrimary: true,
            button: type === "pointerdown" ? 0 : -1,
            buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
            pressure: type === "pointerup" || type === "pointercancel" ? 0 : 0.5
          }));
          target.dispatchEvent(pointerEvent);
          return;
        }

        var mouseType = "mousemove";
        if (type === "pointerdown") {
          mouseType = "mousedown";
        } else if (type === "pointerup" || type === "pointercancel") {
          mouseType = "mouseup";
        }
        var mouseEvent = new MouseEvent(mouseType, Object.assign({}, baseEvent, {
          button: 0,
          buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1
        }));
        target.dispatchEvent(mouseEvent);
      }

      function cancelDragTouch(changedTouches) {
        if (dragTouchId === null || !dragTarget) {
          dragTouchId = null;
          dragTarget = null;
          return;
        }
        var touch = getTouchByIdentifier(changedTouches, dragTouchId);
        if (touch) {
          dispatchPointerFromTouch("pointercancel", touch, dragTarget);
        }
        dragTouchId = null;
        dragTarget = null;
      }

      document.addEventListener("touchstart", function (event) {
        if (event.touches.length === 1 && dragTouchId === null) {
          if (isUiElement(event.target)) {
            return;
          }
          var startTouch = event.touches[0];
          dragTarget = getTargetCanvas();
          if (dragTarget) {
            dragTouchId = startTouch.identifier;
            dispatchPointerFromTouch("pointerdown", startTouch, dragTarget);
            event.preventDefault();
            return;
          }
        }

        if (event.touches.length !== 2) {
          return;
        }
        cancelDragTouch(event.changedTouches);
        pinchTarget = getTargetCanvas();
        if (!pinchTarget) {
          return;
        }
        pinchDistance = distance(event.touches);
        event.preventDefault();
      }, { passive: false });

      document.addEventListener("touchmove", function (event) {
        if (dragTouchId !== null && event.touches.length === 1 && dragTarget) {
          var dragTouch = getTouchByIdentifier(event.touches, dragTouchId);
          if (dragTouch) {
            dispatchPointerFromTouch("pointermove", dragTouch, dragTarget);
            event.preventDefault();
            return;
          }
        }

        if (event.touches.length !== 2) {
          return;
        }
        if (!pinchTarget) {
          pinchTarget = getTargetCanvas();
        }
        if (!pinchTarget) {
          return;
        }

        var nextDistance = distance(event.touches);
        if (pinchDistance !== null) {
          var delta = nextDistance - pinchDistance;
          pinchTarget.dispatchEvent(createWheelEvent(-delta * 4));
        }
        pinchDistance = nextDistance;
        event.preventDefault();
      }, { passive: false });

      document.addEventListener("touchend", function (event) {
        if (dragTouchId !== null && dragTarget) {
          var endTouch = getTouchByIdentifier(event.changedTouches, dragTouchId);
          if (endTouch) {
            dispatchPointerFromTouch("pointerup", endTouch, dragTarget);
            dragTouchId = null;
            dragTarget = null;
            event.preventDefault();
          }
        }
        if (event.touches.length < 2) {
          pinchDistance = null;
          pinchTarget = null;
        }
      }, { passive: false });

      document.addEventListener("touchcancel", function (event) {
        cancelDragTouch(event.changedTouches);
        pinchDistance = null;
        pinchTarget = null;
      }, { passive: false });

      document.addEventListener("gesturestart", function (event) {
        event.preventDefault();
      }, { passive: false });
      document.addEventListener("gesturechange", function (event) {
        event.preventDefault();
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

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [webKey, setWebKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);

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
          onError={() => setHasError(true)}
          onHttpError={() => setHasError(true)}
        />
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
  }
});
