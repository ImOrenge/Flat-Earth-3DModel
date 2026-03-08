import * as THREE from "../vendor/three.module.js";

export function createTextureManager({
  constants,
  renderer,
  topMaterial,
  statusEl
}) {
  const targetTextureSize = Math.min(
    constants.MAP_TEXTURE_SIZE,
    renderer.capabilities.maxTextureSize || constants.MAP_TEXTURE_SIZE
  );

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function drawOrbitCircle(ctx, size, radius, strokeStyle) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius * (size / 2), 0, Math.PI * 2);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = Math.max(2, size * constants.ORBIT_SURFACE_LINE_WIDTH);
    ctx.shadowColor = strokeStyle;
    ctx.shadowBlur = size * 0.01;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawSurfaceOrbitGuides(ctx, size) {
    drawOrbitCircle(ctx, size, constants.TROPIC_CANCER_RADIUS / constants.DISC_RADIUS, "rgba(255, 203, 113, 0.92)");
    drawOrbitCircle(ctx, size, constants.EQUATOR_RADIUS / constants.DISC_RADIUS, "rgba(133, 224, 255, 0.88)");
    drawOrbitCircle(ctx, size, constants.TROPIC_CAPRICORN_RADIUS / constants.DISC_RADIUS, "rgba(255, 148, 188, 0.92)");
  }

  function configureTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    topMaterial.map = texture;
    topMaterial.needsUpdate = true;
  }

  function createSquareTextureFromImage(image) {
    const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sourceX = Math.floor((sourceWidth - side) / 2);
    const sourceY = Math.floor((sourceHeight - side) / 2);

    const mapCanvas = document.createElement("canvas");
    mapCanvas.width = targetTextureSize;
    mapCanvas.height = targetTextureSize;

    const ctx = mapCanvas.getContext("2d");
    ctx.clearRect(0, 0, targetTextureSize, targetTextureSize);
    ctx.drawImage(image, sourceX, sourceY, side, side, 0, 0, targetTextureSize, targetTextureSize);
    drawSurfaceOrbitGuides(ctx, targetTextureSize);

    const texture = new THREE.CanvasTexture(mapCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function loadSquareTexture(url, successMessage, errorHandler, finalize) {
    const image = new Image();
    image.onload = () => {
      configureTexture(createSquareTextureFromImage(image));
      setStatus(successMessage);
      if (finalize) {
        finalize();
      }
    };
    image.onerror = () => {
      errorHandler();
      if (finalize) {
        finalize();
      }
    };
    image.src = url;
  }

  function createFallbackTexture() {
    const mapCanvas = document.createElement("canvas");
    mapCanvas.width = targetTextureSize;
    mapCanvas.height = targetTextureSize;
    const size = targetTextureSize;
    const ctx = mapCanvas.getContext("2d");

    const center = size / 2;
    const outerRadius = size / 2;
    const innerRadius = Math.max(120, size * 0.06);
    const gradient = ctx.createRadialGradient(center, center, innerRadius, center, center, outerRadius);
    gradient.addColorStop(0, "#2d6d92");
    gradient.addColorStop(1, "#0c3953");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(210, 233, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let ring = size * 0.088; ring <= size * 0.464; ring += size * 0.054) {
      ctx.beginPath();
      ctx.arc(center, center, ring, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(angle) * (size * 0.469), center + Math.sin(angle) * (size * 0.469));
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.round(size * 0.055)}px Space Grotesk, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("DROP A FLAT MAP", center, center - (size * 0.022));
    ctx.font = `${Math.round(size * 0.02)}px Space Grotesk, sans-serif`;
    ctx.fillStyle = "rgba(235,245,255,0.9)";
    ctx.fillText("or place assets/flat-earth-map-square.svg", center, center + (size * 0.017));
    drawSurfaceOrbitGuides(ctx, size);

    const fallback = new THREE.CanvasTexture(mapCanvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  function applyFallback() {
    configureTexture(createFallbackTexture());
    setStatus("Fallback texture is active until a map image is loaded.");
  }

  function loadDefaultTexture() {
    loadSquareTexture(
      constants.DEFAULT_MAP_PATH,
      `${constants.DEFAULT_MAP_LABEL} texture loaded into the square top surface.`,
      () => {
        applyFallback();
      }
    );
  }

  function loadUserTexture(file) {
    if (!file) {
      return;
    }

    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (!isSvg) {
      setStatus("Only SVG map uploads are allowed.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    loadSquareTexture(
      objectUrl,
      `${file.name} texture loaded into the square top surface.`,
      () => {
        setStatus("Could not load the SVG image. Try another .svg file.");
      },
      () => {
        URL.revokeObjectURL(objectUrl);
      }
    );
  }

  return {
    loadDefaultTexture,
    loadUserTexture
  };
}
