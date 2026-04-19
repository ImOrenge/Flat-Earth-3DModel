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
  const sampleState = {
    canvas: null,
    context: null,
    imageData: null,
    ready: false,
    width: 0,
    height: 0,
    version: 0
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
    rebuildSamplingCanvas(texture);
  }

  function rebuildSamplingCanvas(texture) {
    const image = texture?.image;
    const sourceWidth = image?.videoWidth ?? image?.naturalWidth ?? image?.width ?? 0;
    const sourceHeight = image?.videoHeight ?? image?.naturalHeight ?? image?.height ?? 0;

    if (!image || !sourceWidth || !sourceHeight) {
      sampleState.canvas = null;
      sampleState.context = null;
      sampleState.imageData = null;
      sampleState.ready = false;
      sampleState.width = 0;
      sampleState.height = 0;
      sampleState.version += 1;
      return;
    }

    const sampleWidth = Math.min(sourceWidth, 2048);
    const sampleHeight = Math.max(1, Math.min(sourceHeight, 1024));
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

    sampleState.canvas = canvas;
    sampleState.context = context;
    sampleState.imageData = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    sampleState.ready = true;
    sampleState.width = sampleWidth;
    sampleState.height = sampleHeight;
    sampleState.version += 1;
  }

  function getNormalizedSampleCoordinates(latitudeDegrees, longitudeDegrees) {
    if (!sampleState.ready || !sampleState.imageData || !sampleState.width || !sampleState.height) {
      return null;
    }

    const wrappedLongitude = ((((longitudeDegrees + 180) % 360) + 360) % 360) - 180;
    const normalizedLatitude = THREE.MathUtils.clamp((90 - latitudeDegrees) / 180, 0, 1);
    const normalizedLongitude = ((((wrappedLongitude + 180) / 360) % 1) + 1) % 1;

    return {
      x: normalizedLongitude * (sampleState.width - 1),
      y: normalizedLatitude * (sampleState.height - 1)
    };
  }

  function getPixelColor(x, y) {
    if (!sampleState.ready || !sampleState.imageData || !sampleState.width || !sampleState.height) {
      return null;
    }

    const wrappedX = ((((x % sampleState.width) + sampleState.width) % sampleState.width) | 0);
    const clampedY = Math.min(sampleState.height - 1, Math.max(0, y | 0));
    const pixelIndex = ((clampedY * sampleState.width) + wrappedX) * 4;
    const pixel = sampleState.imageData;

    return {
      r: pixel[pixelIndex] / 255,
      g: pixel[pixelIndex + 1] / 255,
      b: pixel[pixelIndex + 2] / 255
    };
  }

  function samplePixel(latitudeDegrees, longitudeDegrees) {
    const coordinates = getNormalizedSampleCoordinates(latitudeDegrees, longitudeDegrees);
    if (!coordinates) {
      return null;
    }

    const x0 = Math.floor(coordinates.x);
    const y0 = Math.floor(coordinates.y);
    const x1 = x0 + 1;
    const y1 = Math.min(y0 + 1, sampleState.height - 1);
    const tx = coordinates.x - x0;
    const ty = coordinates.y - y0;
    const c00 = getPixelColor(x0, y0);
    const c10 = getPixelColor(x1, y0);
    const c01 = getPixelColor(x0, y1);
    const c11 = getPixelColor(x1, y1);

    if (!c00 || !c10 || !c01 || !c11) {
      return null;
    }

    const mixChannel = (topLeft, topRight, bottomLeft, bottomRight) => {
      const top = THREE.MathUtils.lerp(topLeft, topRight, tx);
      const bottom = THREE.MathUtils.lerp(bottomLeft, bottomRight, tx);
      return THREE.MathUtils.lerp(top, bottom, ty);
    };

    return {
      r: mixChannel(c00.r, c10.r, c01.r, c11.r),
      g: mixChannel(c00.g, c10.g, c01.g, c11.g),
      b: mixChannel(c00.b, c10.b, c01.b, c11.b)
    };
  }

  function getOffsetGeoCoordinate(centerLatitudeDegrees, centerLongitudeDegrees, azimuthRadians, distanceDegrees) {
    const latitudeRadians = THREE.MathUtils.degToRad(centerLatitudeDegrees);
    const northOffset = Math.cos(azimuthRadians) * distanceDegrees;
    const eastOffset = Math.sin(azimuthRadians) * distanceDegrees;
    const latitudeDegrees = THREE.MathUtils.clamp(
      centerLatitudeDegrees + northOffset,
      -89.5,
      89.5
    );
    const longitudeScale = Math.max(Math.cos(latitudeRadians), 0.15);
    const longitudeDegrees = centerLongitudeDegrees + (eastOffset / longitudeScale);

    return {
      latitudeDegrees,
      longitudeDegrees
    };
  }

  function classifySample(rgb) {
    if (!rgb) {
      return null;
    }

    const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
    const minChannel = Math.min(rgb.r, rgb.g, rgb.b);
    const saturation = maxChannel - minChannel;
    const luminance = (0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b);
    const waterness = THREE.MathUtils.clamp(((rgb.b - ((rgb.r + rgb.g) * 0.5)) + 0.06) * 3.2, 0, 1);
    const ice = THREE.MathUtils.clamp(((luminance - 0.62) * 3.1) * (1 - (saturation * 1.8)), 0, 1);
    const vegetation = THREE.MathUtils.clamp(((rgb.g - rgb.r) * 2.2) + ((rgb.g - rgb.b) * 1.1), 0, 1) * (1 - waterness);
    const arid = THREE.MathUtils.clamp(((rgb.r + rgb.g) - (rgb.b * 1.35) - 0.18) * 1.6, 0, 1) * (1 - waterness);

    return {
      ...rgb,
      arid,
      ice,
      luminance,
      saturation,
      vegetation,
      waterness
    };
  }

  function blendClassifiedSamples(samples) {
    const validSamples = samples.filter(Boolean);
    if (validSamples.length === 0) {
      return null;
    }

    const totals = validSamples.reduce((accumulator, sample) => {
      accumulator.r += sample.r;
      accumulator.g += sample.g;
      accumulator.b += sample.b;
      accumulator.waterness += sample.waterness;
      accumulator.vegetation += sample.vegetation;
      accumulator.arid += sample.arid;
      accumulator.ice += sample.ice;
      accumulator.luminance += sample.luminance;
      return accumulator;
    }, {
      r: 0,
      g: 0,
      b: 0,
      waterness: 0,
      vegetation: 0,
      arid: 0,
      ice: 0,
      luminance: 0
    });

    const sampleCount = validSamples.length;
    return {
      r: totals.r / sampleCount,
      g: totals.g / sampleCount,
      b: totals.b / sampleCount,
      waterness: totals.waterness / sampleCount,
      vegetation: totals.vegetation / sampleCount,
      arid: totals.arid / sampleCount,
      ice: totals.ice / sampleCount,
      luminance: totals.luminance / sampleCount
    };
  }

  function getSurfaceSample(latitudeDegrees, longitudeDegrees, neighborhoodDegrees = 3) {
    const offsets = [
      [0, 0],
      [neighborhoodDegrees, 0],
      [-neighborhoodDegrees, 0],
      [0, neighborhoodDegrees],
      [0, -neighborhoodDegrees],
      [neighborhoodDegrees * 0.7, neighborhoodDegrees * 0.7],
      [neighborhoodDegrees * 0.7, -neighborhoodDegrees * 0.7],
      [-neighborhoodDegrees * 0.7, neighborhoodDegrees * 0.7],
      [-neighborhoodDegrees * 0.7, -neighborhoodDegrees * 0.7]
    ];
    const samples = offsets.map(([latitudeOffset, longitudeOffset]) => classifySample(
      samplePixel(latitudeDegrees + latitudeOffset, longitudeDegrees + longitudeOffset)
    ));

    return blendClassifiedSamples(samples);
  }

  function drawSurfacePatch(context, width, height, {
    angularRadiusDegrees = 3.2,
    centerLatitudeDegrees,
    centerLongitudeDegrees,
    gridOpacity = 0.045,
    overlayOpacity = 0.08,
    resolution = 192
  } = {}) {
    if (!context || !sampleState.ready || centerLatitudeDegrees === undefined || centerLongitudeDegrees === undefined) {
      return false;
    }

    const patchResolution = Math.max(96, Math.min(320, resolution | 0));
    const imageData = context.createImageData(patchResolution, patchResolution);
    const data = imageData.data;
    const maxDistanceDegrees = angularRadiusDegrees * Math.SQRT2;

    for (let y = 0; y < patchResolution; y += 1) {
      const northOffset = (0.5 - ((y + 0.5) / patchResolution)) * angularRadiusDegrees * 2;
      for (let x = 0; x < patchResolution; x += 1) {
        const eastOffset = (((x + 0.5) / patchResolution) - 0.5) * angularRadiusDegrees * 2;
        const azimuthRadians = Math.atan2(eastOffset, northOffset);
        const distanceDegrees = Math.min(
          Math.hypot(eastOffset, northOffset),
          maxDistanceDegrees
        );
        const sampleGeo = getOffsetGeoCoordinate(
          centerLatitudeDegrees,
          centerLongitudeDegrees,
          azimuthRadians,
          distanceDegrees
        );
        const sample = samplePixel(sampleGeo.latitudeDegrees, sampleGeo.longitudeDegrees);
        const pixelIndex = ((y * patchResolution) + x) * 4;

        data[pixelIndex] = Math.round((sample?.r ?? 0.43) * 255);
        data[pixelIndex + 1] = Math.round((sample?.g ?? 0.51) * 255);
        data[pixelIndex + 2] = Math.round((sample?.b ?? 0.46) * 255);
        data[pixelIndex + 3] = 255;
      }
    }

    const previousSmoothing = context.imageSmoothingEnabled;
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = patchResolution;
    patchCanvas.height = patchResolution;
    patchCanvas.getContext("2d").putImageData(imageData, 0, 0);
    context.drawImage(patchCanvas, 0, 0, width, height);

    if (overlayOpacity > 0) {
      context.save();
      context.globalCompositeOperation = "multiply";
      for (let layer = 0; layer < 6; layer += 1) {
        const alpha = overlayOpacity * (0.18 + (layer * 0.1));
        context.strokeStyle = `rgba(28,34,29,${alpha})`;
        context.lineWidth = 1.5 + (layer * 1.25);
        context.beginPath();
        context.arc(width / 2, height / 2, width * (0.15 + (layer * 0.08)), 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    }

    if (gridOpacity > 0) {
      context.save();
      context.strokeStyle = `rgba(255,255,255,${gridOpacity})`;
      context.lineWidth = 1;
      const gridCount = 6;
      for (let index = 1; index < gridCount; index += 1) {
        const t = index / gridCount;
        const lineX = width * t;
        const lineY = height * t;
        context.beginPath();
        context.moveTo(lineX, 0);
        context.lineTo(lineX, height);
        context.stroke();
        context.beginPath();
        context.moveTo(0, lineY);
        context.lineTo(width, lineY);
        context.stroke();
      }
      context.restore();
    }

    context.imageSmoothingEnabled = previousSmoothing;
    return true;
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
    drawSurfacePatch,
    getSurfaceSample,
    getSurfaceSampleVersion() {
      return sampleState.version;
    },
    loadDefaultTexture,
    loadUserTexture,
    refreshLocalizedUi
  };
}
