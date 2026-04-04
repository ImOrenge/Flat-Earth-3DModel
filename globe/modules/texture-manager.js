import * as THREE from "../../vendor/three.module.js";

export function createTextureManager({
  constants,
  i18n,
  renderer,
  surfaceMaterial,
  statusEl,
  onTextureUpdated
}) {
  const isMobileViewport = typeof window !== "undefined"
    ? (typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1080px)").matches
      : window.innerWidth <= 1080)
    : false;
  const isAppMode = typeof window !== "undefined"
    && (
      window.__APP_MODE__ === true
      || new URLSearchParams(window?.location?.search || "").get("app") === "1"
    );
  const useMobileTextureProfile = isMobileViewport || isAppMode;
  const maxTextureSize = renderer.capabilities.maxTextureSize || 4096;
  const textureWidth = Math.min(
    useMobileTextureProfile ? 2048 : 4096,
    maxTextureSize
  );
  const textureHeight = Math.max(1, Math.floor(textureWidth / 2));
  const maxAnisotropy = Math.max(renderer.capabilities.getMaxAnisotropy?.() || 1, 1);
  const targetAnisotropy = useMobileTextureProfile
    ? Math.min(maxAnisotropy, 2)
    : maxAnisotropy;
  const statusState = {
    key: "statusLoadingBundledMap",
    params: {}
  };
  const textureState = {
    mode: "default"
  };
  const nightLightsTextureData = new Uint8Array(4 * 4 * 4);
  const nightLightsTexture = new THREE.DataTexture(
    nightLightsTextureData,
    4,
    4,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  nightLightsTexture.wrapS = THREE.ClampToEdgeWrapping;
  nightLightsTexture.wrapT = THREE.ClampToEdgeWrapping;
  nightLightsTexture.magFilter = THREE.LinearFilter;
  nightLightsTexture.minFilter = THREE.LinearFilter;
  nightLightsTexture.generateMipmaps = false;
  nightLightsTexture.flipY = false;
  nightLightsTexture.needsUpdate = true;

  function setStatus(key, params = {}) {
    statusState.key = key;
    statusState.params = params;
    statusEl.textContent = i18n.t(key, params);
  }

  function configureTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = targetAnisotropy;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    if (useMobileTextureProfile) {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
    } else {
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
    texture.needsUpdate = true;
    surfaceMaterial.map = texture;
    surfaceMaterial.needsUpdate = true;
  }

  function createFallbackTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const ctx = canvas.getContext("2d");

    const skyGradient = ctx.createLinearGradient(0, 0, 0, textureHeight);
    skyGradient.addColorStop(0, "#1b3654");
    skyGradient.addColorStop(0.45, "#14304c");
    skyGradient.addColorStop(1, "#0b1826");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    ctx.strokeStyle = "rgba(190, 225, 255, 0.14)";
    ctx.lineWidth = Math.max(1, textureWidth * 0.0008);
    for (let lon = 0; lon <= 12; lon += 1) {
      const x = (textureWidth / 12) * lon;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, textureHeight);
      ctx.stroke();
    }

    for (let lat = 0; lat <= 6; lat += 1) {
      const y = (textureHeight / 6) * lat;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(textureWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(238, 247, 255, 0.92)";
    ctx.font = `700 ${Math.round(textureWidth * 0.026)}px Space Grotesk, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(i18n.t("fallbackTextureTitle"), textureWidth / 2, textureHeight * 0.46);
    ctx.font = `${Math.round(textureWidth * 0.012)}px Space Grotesk, sans-serif`;
    ctx.fillStyle = "rgba(214, 231, 248, 0.9)";
    ctx.fillText(i18n.t("fallbackTextureSubtitle"), textureWidth / 2, textureHeight * 0.54);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function applyFallback() {
    textureState.mode = "fallback";
    configureTexture(createFallbackTexture());
    setStatus("statusFallbackTexture");
    onTextureUpdated?.();
  }

  function loadTexture(url, successKey, successParams, errorKey, finalize, mode = "default") {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        textureState.mode = mode;
        configureTexture(texture);
        setStatus(successKey, successParams);
        onTextureUpdated?.();
        finalize?.();
      },
      undefined,
      () => {
        if (errorKey) {
          setStatus(errorKey);
        }
        if (mode === "default") {
          applyFallback();
        }
        finalize?.();
      }
    );
  }

  function loadDefaultTexture() {
    loadTexture(
      constants.DEFAULT_GLOBE_TEXTURE_PATH,
      "statusDefaultTextureLoaded",
      { label: constants.DEFAULT_MAP_LABEL },
      null,
      undefined,
      "default"
    );
  }

  function loadUserTexture(file) {
    if (!file) {
      return;
    }

    const isImage = file.type.startsWith("image/")
      || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
    if (!isImage) {
      setStatus("statusOnlyImageAllowed");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    loadTexture(
      objectUrl,
      "statusUserTextureLoaded",
      { fileName: file.name },
      "statusImageLoadFailed",
      () => URL.revokeObjectURL(objectUrl),
      "user"
    );
  }

  function refreshLocalizedUi() {
    if (textureState.mode === "fallback") {
      applyFallback();
      return;
    }

    setStatus(statusState.key, statusState.params);
  }

  return {
    getNightLightsTexture() {
      return nightLightsTexture;
    },
    loadDefaultTexture,
    loadUserTexture,
    refreshLocalizedUi
  };
}
