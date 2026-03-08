import * as THREE from "../vendor/three.module.js";

export function createTextureManager({
  constants,
  renderer,
  topMaterial,
  statusEl
}) {
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
    mapCanvas.width = side;
    mapCanvas.height = side;

    const ctx = mapCanvas.getContext("2d");
    ctx.clearRect(0, 0, side, side);
    ctx.drawImage(image, sourceX, sourceY, side, side, 0, 0, side, side);
    drawSurfaceOrbitGuides(ctx, side);

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
    mapCanvas.width = 2048;
    mapCanvas.height = 2048;
    const ctx = mapCanvas.getContext("2d");

    const gradient = ctx.createRadialGradient(1024, 1024, 120, 1024, 1024, 1024);
    gradient.addColorStop(0, "#2d6d92");
    gradient.addColorStop(1, "#0c3953");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2048, 2048);

    ctx.strokeStyle = "rgba(210, 233, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let ring = 180; ring <= 950; ring += 110) {
      ctx.beginPath();
      ctx.arc(1024, 1024, ring, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      ctx.beginPath();
      ctx.moveTo(1024, 1024);
      ctx.lineTo(1024 + Math.cos(angle) * 960, 1024 + Math.sin(angle) * 960);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 112px Space Grotesk, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DROP A FLAT MAP", 1024, 980);
    ctx.font = "40px Space Grotesk, sans-serif";
    ctx.fillStyle = "rgba(235,245,255,0.9)";
    ctx.fillText("or place assets/flat-earth-map.png", 1024, 1060);
    drawSurfaceOrbitGuides(ctx, 2048);

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

    const objectUrl = URL.createObjectURL(file);
    loadSquareTexture(
      objectUrl,
      `${file.name} texture loaded into the square top surface.`,
      () => {
        setStatus("Could not load the image. Try a PNG or JPG file.");
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
