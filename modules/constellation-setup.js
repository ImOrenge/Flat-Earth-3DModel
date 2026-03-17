import * as THREE from "../vendor/three.module.js";
import { scaleDimension, DOME_BASE_Y, DOME_RADIUS, DOME_VERTICAL_SCALE } from "./constants.js";

// Fetch the constellation data.
const response = await fetch("./modules/constellation-data.json");
const constellationData = await response.json();

export const CONSTELLATION_STAR_SIZE = scaleDimension(0.25); // Larger bound for soft glow
export const CONSTELLATION_STAR_COLOR = 0xffffff;
export const CONSTELLATION_LINE_COLOR = 0x44aaff;
export const CONSTELLATION_LINE_OPACITY = 0.15;
export const GRID_LINE_COLOR = 0xcca055; // Gold/bronze tint from reference
export const GRID_LINE_OPACITY = 0.2;

function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.1, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.3)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createConstellations() {
  const group = new THREE.Group();
  
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: CONSTELLATION_STAR_COLOR,
    size: CONSTELLATION_STAR_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    map: createStarTexture(),
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    depthWrite: false,
    depthTest: false
  });
  
  const lineMaterial = new THREE.LineBasicMaterial({
    color: CONSTELLATION_LINE_COLOR,
    transparent: true,
    opacity: CONSTELLATION_LINE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  
  const starPositions = [];
  const starColors = [];
  
  for (const [name, data] of Object.entries(constellationData)) {
    const localPositions = [];
    
    for (const star of data.stars) {
      // RA is in hours (0 to 24). Convert to radians (0 to 2PI).
      // Dec is in degrees (-90 to +90). Convert to radians (-PI/2 to +PI/2).
      const raRad = (star.ra / 24) * Math.PI * 2;
      const decRad = (star.dec / 180) * Math.PI;
      
      // Map to dome surface.
      // Polaris is at dec +90 (top of dome).
      // Equator is dec 0.
      // Top of dome is phi 0, equator is phi PI/2.
      // So phi = (PI / 2) - decRad.
      const phi = (Math.PI / 2) - decRad;
      
      // Theta corresponds to RA. 0 RA can be +X.
      const theta = raRad;
      
      // Calculate coordinates on a unit hemisphere
      const x = Math.sin(phi) * Math.cos(theta);
      const z = Math.sin(phi) * Math.sin(theta);
      const y = Math.max(0, Math.cos(phi)); // Clamp y to avoid going below dome base if dec is very negative
      
      // Scale to dome dimensions, slightly inside to avoid z-fighting
      const px = x * DOME_RADIUS * 0.98;
      const pz = z * DOME_RADIUS * 0.98;
      const py = (y * DOME_RADIUS * 0.98 * DOME_VERTICAL_SCALE) + DOME_BASE_Y;
      
      // We want to project exactly onto the dome's inner surface.
      // The dome is centered at y=DOME_BASE_Y
      const starVec = new THREE.Vector3(px, py, pz);
      localPositions.push(starVec);
      starPositions.push(px, py, pz);
      
      const brightness = 0.4 + Math.random() * 0.6;
      starColors.push(brightness, brightness * 0.95, brightness * 0.9); // Slight warmth
    }
    
    // Draw lines
    if (data.lines && data.lines.length > 0) {
      const linePositions = [];
      for (const [startIdx, endIdx] of data.lines) {
        const start = localPositions[startIdx];
        const end = localPositions[endIdx];
        if (start && end) {
          linePositions.push(start.x, start.y, start.z);
          linePositions.push(end.x, end.y, end.z);
        }
      }
      
      if (linePositions.length > 0) {
        const lineGeom = new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(linePositions, 3)
        );
        const lines = new THREE.LineSegments(lineGeom, lineMaterial);
        lines.renderOrder = 22;
        group.add(lines);
      }
    }
  }
  
  if (starPositions.length > 0) {
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.renderOrder = 23;
    group.add(stars);
  }
  
  // Create Astrological Wheel Grid (12 spokes, concentric circles)
  const gridMaterial = new THREE.LineBasicMaterial({
    color: GRID_LINE_COLOR,
    transparent: true,
    opacity: GRID_LINE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  
  // 1. Draw concentric rings (Dec circles)
  // E.g., at Dec +60, +30, 0 (Equator), -30
  const ringDecs = [60, 30, 0, -30];
  for (const dec of ringDecs) {
    const ringGeom = new THREE.BufferGeometry();
    const ringPts = [];
    const decRad = (dec / 180) * Math.PI;
    const phi = (Math.PI / 2) - decRad;
    const y = Math.max(0, Math.cos(phi));
    const radius = Math.sin(phi);
    
    // Generate circle
    for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        const px = radius * Math.cos(theta) * DOME_RADIUS * 0.98;
        const pz = radius * Math.sin(theta) * DOME_RADIUS * 0.98;
        const py = (y * DOME_RADIUS * 0.98 * DOME_VERTICAL_SCALE) + DOME_BASE_Y;
        ringPts.push(px, py, pz);
    }
    ringGeom.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
    const ring = new THREE.Line(ringGeom, gridMaterial);
    ring.renderOrder = 21;
    group.add(ring);
  }
  
  // 2. Draw 12 radial spokes (every 2 hours / 30 degrees of RA)
  // Extending from Dec +80 down to Dec -30
  const spokeGeom = new THREE.BufferGeometry();
  const spokePts = [];
  const startDecRad = (80 / 180) * Math.PI;
  const startPhi = (Math.PI / 2) - startDecRad;
  const startY = Math.max(0, Math.cos(startPhi));
  const startRadius = Math.sin(startPhi);
  
  const endDecRad = (-30 / 180) * Math.PI;
  const endPhi = (Math.PI / 2) - endDecRad;
  const endY = Math.max(0, Math.cos(endPhi));
  const endRadius = Math.sin(endPhi);

  for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2;
      const startPx = startRadius * Math.cos(theta) * DOME_RADIUS * 0.98;
      const startPz = startRadius * Math.sin(theta) * DOME_RADIUS * 0.98;
      const startPy = (startY * DOME_RADIUS * 0.98 * DOME_VERTICAL_SCALE) + DOME_BASE_Y;
      
      const endPx = endRadius * Math.cos(theta) * DOME_RADIUS * 0.98;
      const endPz = endRadius * Math.sin(theta) * DOME_RADIUS * 0.98;
      const endPy = (endY * DOME_RADIUS * 0.98 * DOME_VERTICAL_SCALE) + DOME_BASE_Y;
      
      spokePts.push(startPx, startPy, startPz);
      spokePts.push(endPx, endPy, endPz);
  }
  spokeGeom.setAttribute("position", new THREE.Float32BufferAttribute(spokePts, 3));
  const spokes = new THREE.LineSegments(spokeGeom, gridMaterial);
  spokes.renderOrder = 21;
  group.add(spokes);

  console.log(`Constellations setup: ${Object.keys(constellationData).length} constellations, ${starPositions.length/3} stars.`);
  
  // Rotate group so Polaris RA aligns with something specific if needed.
  // We'll leave it as is.
  return group;
}
