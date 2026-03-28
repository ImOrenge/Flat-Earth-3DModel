import type { CameraGestureInput, HudState, TimeMode } from "@flat-earth/core-sim";
import type { ExpoWebGLRenderingContext } from "expo-gl";

export interface EngineInitParams {
  gl: ExpoWebGLRenderingContext;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface EngineBridge {
  init(params: EngineInitParams): Promise<void>;
  resize(width: number, height: number, pixelRatio: number): void;
  tick(timeMs: number): void;
  setObservationTime(next: Date | number | string): void;
  setTimeMode(mode: TimeMode): void;
  setAppActive(active: boolean): void;
  setCameraGesture(input: CameraGestureInput): void;
  getHudSnapshot(): HudState;
  dispose(): void;
}
