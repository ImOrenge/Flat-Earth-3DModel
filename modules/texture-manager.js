import * as THREE from "../vendor/three.module.js";

export function createTextureManager({
  constants,
  renderer,
  topMaterial,
  statusEl,
  onTextureUpdated
}) {
  const targetTextureSize = Math.min(
    constants.MAP_TEXTURE_SIZE,
    renderer.capabilities.maxTextureSize || constants.MAP_TEXTURE_SIZE
  );
  const nightLightsCanvas = document.createElement("canvas");
  nightLightsCanvas.width = constants.DAY_NIGHT_TEXTURE_SIZE;
  nightLightsCanvas.height = constants.DAY_NIGHT_TEXTURE_SIZE;
  const nightLightsCtx = nightLightsCanvas.getContext("2d", { willReadFrequently: true });
  const nightLightsData = new Float32Array(constants.DAY_NIGHT_TEXTURE_SIZE * constants.DAY_NIGHT_TEXTURE_SIZE);

  function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - (2 * t));
  }

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

  function clearNightLights() {
    nightLightsData.fill(0);
    nightLightsCtx.clearRect(0, 0, nightLightsCanvas.width, nightLightsCanvas.height);
  }

  function estimateOceanColor(data, size) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const normalizedX = ((x + 0.5) / size) - 0.5;
        const normalizedY = ((y + 0.5) / size) - 0.5;
        const radialDistance = Math.hypot(normalizedX, normalizedY) * 2;
        if (radialDistance > 1 || radialDistance < 0.3) {
          continue;
        }

        const index = (y * size + x) * 4;
        const alpha = data[index + 3];
        if (alpha < 12) {
          continue;
        }

        const sampleRed = data[index];
        const sampleGreen = data[index + 1];
        const sampleBlue = data[index + 2];
        const blueDominance = sampleBlue - ((sampleRed + sampleGreen) * 0.5);
        if (blueDominance < 8) {
          continue;
        }

        red += sampleRed;
        green += sampleGreen;
        blue += sampleBlue;
        count += 1;
      }
    }

    if (count === 0) {
      return { red: 42, green: 88, blue: 118 };
    }

    return {
      red: red / count,
      green: green / count,
      blue: blue / count
    };
  }

  function blurIntensityMap(source, size, radius) {
    if (radius <= 0) {
      return source.slice();
    }

    const horizontal = new Float32Array(source.length);
    const output = new Float32Array(source.length);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = 0;
        let samples = 0;
        const startX = Math.max(0, x - radius);
        const endX = Math.min(size - 1, x + radius);

        for (let sampleX = startX; sampleX <= endX; sampleX += 1) {
          sum += source[(y * size) + sampleX];
          samples += 1;
        }

        horizontal[(y * size) + x] = sum / samples;
      }
    }

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = 0;
        let samples = 0;
        const startY = Math.max(0, y - radius);
        const endY = Math.min(size - 1, y + radius);

        for (let sampleY = startY; sampleY <= endY; sampleY += 1) {
          sum += horizontal[(sampleY * size) + x];
          samples += 1;
        }

        output[(y * size) + x] = sum / samples;
      }
    }

    return output;
  }

  function sampleNoise(x, y, frequency) {
    const seed = (x * frequency * 12.9898) + (y * frequency * 78.233);
    const noise = Math.sin(seed) * 43758.5453123;
    return noise - Math.floor(noise);
  }

  function updateNightLightsFromCanvas(sourceCanvas) {
    const size = constants.DAY_NIGHT_TEXTURE_SIZE;
    nightLightsCtx.clearRect(0, 0, size, size);
    nightLightsCtx.drawImage(sourceCanvas, 0, 0, size, size);
    const { data } = nightLightsCtx.getImageData(0, 0, size, size);
    const oceanColor = estimateOceanColor(data, size);
    const landMask = new Float32Array(size * size);
    const settlementMask = new Float32Array(size * size);
    const fertileMask = new Float32Array(size * size);
    const aridMask = new Float32Array(size * size);
    const coastSeed = new Float32Array(size * size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const normalizedX = ((x + 0.5) / size) - 0.5;
        const normalizedY = ((y + 0.5) / size) - 0.5;
        const radialDistance = Math.hypot(normalizedX, normalizedY) * 2;
        const maskIndex = (y * size) + x;

        if (radialDistance > 1) {
          landMask[maskIndex] = 0;
          settlementMask[maskIndex] = 0;
          continue;
        }

        const pixelIndex = maskIndex * 4;
        const alpha = data[pixelIndex + 3] / 255;
        if (alpha < 0.04) {
          continue;
        }

        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const saturation = (maxChannel - minChannel) / 255;
        const luminance = ((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) / 255;
        const colorDistance = Math.hypot(
          red - oceanColor.red,
          green - oceanColor.green,
          blue - oceanColor.blue
        ) / 255;
        const blueDominance = (blue - ((red + green) * 0.5)) / 255;
        const greenDominance = (green - ((red + blue) * 0.5)) / 255;
        const warmDominance = (((red + green) * 0.5) - blue) / 255;
        const distanceScore = smoothstep(0.16, 0.52, colorDistance);
        const warmthScore = smoothstep(-0.02, 0.2, warmDominance);
        const waterPenalty = smoothstep(0.06, 0.28, blueDominance);
        const radialPenalty = smoothstep(0.93, 1, radialDistance);
        const landScore = clamp01(
          (distanceScore * 0.8) +
          (warmthScore * 0.38) +
          (saturation * 0.18) +
          (smoothstep(0.18, 0.82, luminance) * 0.08) -
          (waterPenalty * 0.45) -
          (radialPenalty * 0.18)
        );

        if (landScore < 0.12) {
          landMask[maskIndex] = 0;
          settlementMask[maskIndex] = 0;
          continue;
        }

        landMask[maskIndex] = landScore;
        fertileMask[maskIndex] = clamp01(
          (smoothstep(-0.03, 0.18, greenDominance) * 0.82) +
          (smoothstep(0.18, 0.72, luminance) * 0.18)
        );
        aridMask[maskIndex] = clamp01(
          smoothstep(0.08, 0.32, warmDominance) *
          smoothstep(0.42, 0.82, luminance) *
          (1 - smoothstep(0.02, 0.18, greenDominance))
        );
      }
    }

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const maskIndex = (y * size) + x;
        if (landMask[maskIndex] < 0.12) {
          continue;
        }

        let coastalWaterNeighbors = 0;
        let neighborSamples = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= size) {
            continue;
          }

          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if ((offsetX === 0 && offsetY === 0) || sampleX < 0 || sampleX >= size) {
              continue;
            }

            neighborSamples += 1;
            if (landMask[(sampleY * size) + sampleX] < 0.08) {
              coastalWaterNeighbors += 1;
            }
          }
        }

        coastSeed[maskIndex] = coastalWaterNeighbors / Math.max(neighborSamples, 1);
      }
    }

    const coastInfluence = blurIntensityMap(coastSeed, size, 4);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const maskIndex = (y * size) + x;
        if (landMask[maskIndex] < 0.12) {
          settlementMask[maskIndex] = 0;
          continue;
        }

        const normalizedX = ((x + 0.5) / size) - 0.5;
        const normalizedY = ((y + 0.5) / size) - 0.5;
        const radialDistance = Math.hypot(normalizedX, normalizedY) * 2;
        const continentalBias = clamp01(1 - smoothstep(0, 0.18, radialDistance));
        const temperateBias = smoothstep(0.08, 0.8, radialDistance) * (1 - smoothstep(0.82, 0.98, radialDistance));
        const antarcticaSuppression = smoothstep(0.84, 0.92, radialDistance);
        const arcticPenalty = 1 - smoothstep(0.1, 0.2, radialDistance);
        const northernMidLatitudeBias = (
          smoothstep(0.16, 0.34, radialDistance) *
          (1 - smoothstep(0.48, 0.64, radialDistance))
        );
        const southernDevelopmentPenalty = smoothstep(0.58, 0.82, radialDistance);
        const densityNoise = (
          (sampleNoise(x, y, 0.035) * 0.55) +
          (sampleNoise(x + 19.37, y - 7.91, 0.09) * 0.3) +
          (sampleNoise(x - 41.82, y + 26.14, 0.18) * 0.15)
        );
        const clusterScore = Math.pow(smoothstep(0.48, 0.84, densityNoise), 1.5);
        const coastBias = smoothstep(0.02, 0.16, coastInfluence[maskIndex]);
        const fertilityBias = fertileMask[maskIndex];
        const aridPenalty = aridMask[maskIndex];
        const infrastructureBias = clamp01(
          0.14 +
          (coastBias * 0.9) +
          (fertilityBias * 0.5) +
          (temperateBias * 0.28) +
          (continentalBias * 0.08) +
          (northernMidLatitudeBias * 0.42) -
          (aridPenalty * 0.82) -
          (southernDevelopmentPenalty * 0.3) -
          (arcticPenalty * 0.4)
        );
        const sparsityPenalty = clamp01(
          (aridPenalty * 0.76) +
          ((1 - coastBias) * 0.16) +
          ((1 - fertilityBias) * 0.12) +
          (southernDevelopmentPenalty * 0.18) +
          (arcticPenalty * 0.22)
        );

        settlementMask[maskIndex] = (
          landMask[maskIndex] *
          clusterScore *
          infrastructureBias *
          (1 - sparsityPenalty) *
          (1 - antarcticaSuppression)
        );
      }
    }

    const continentalGlow = blurIntensityMap(landMask, size, 6);
    const settlementGlow = blurIntensityMap(settlementMask, size, 3);

    for (let index = 0; index < nightLightsData.length; index += 1) {
      const x = index % size;
      const y = Math.floor(index / size);
      const normalizedX = ((x + 0.5) / size) - 0.5;
      const normalizedY = ((y + 0.5) / size) - 0.5;
      const radialDistance = Math.hypot(normalizedX, normalizedY) * 2;
      const antarcticaCutoff = 1 - smoothstep(0.8, 0.86, radialDistance);

      nightLightsData[index] = clamp01(
        (
          (continentalGlow[index] * 0.16) +
          (settlementGlow[index] * 1.1) +
          (settlementMask[index] * 0.42)
        ) *
        antarcticaCutoff
      );
    }
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
    updateNightLightsFromCanvas(mapCanvas);
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
      onTextureUpdated?.();
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

    clearNightLights();

    const fallback = new THREE.CanvasTexture(mapCanvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  function applyFallback() {
    configureTexture(createFallbackTexture());
    setStatus("Fallback texture is active until a map image is loaded.");
    onTextureUpdated?.();
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
    getNightLightsData() {
      return nightLightsData;
    },
    loadDefaultTexture,
    loadUserTexture
  };
}
