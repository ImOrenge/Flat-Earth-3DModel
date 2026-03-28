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
          allowsBackForwardNavigationGestures
          mixedContentMode="always"
          setSupportMultipleWindows={false}
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
