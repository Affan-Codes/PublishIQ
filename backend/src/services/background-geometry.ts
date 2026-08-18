/**
 * Background Geometry Calculation Module (MQA-09)
 * 
 * Pure mathematical functions for calculating cover-fit and pan-overscan dimensions
 * from native source asset dimensions for FFmpeg scaling and cropping pipelines.
 * Free of I/O, database dependencies, or external side effects.
 */

export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;
export const DEFAULT_PAN_OVERSCAN_FACTOR = 1.15;

export interface CoverFitResult {
  coverScale: number;
  coveredWidth: number;
  coveredHeight: number;
}

export interface PanOverscanResult {
  coverScale: number;
  finalScale: number;
  scaledWidth: number;
  scaledHeight: number;
  maxPanX: number;
  maxPanY: number;
}

/**
 * Calculates uniform cover-fit dimensions for a source asset to completely cover
 * the target output frame (1080x1920) without stretching or aspect distortion.
 * Used for 'None' and zoom presets (SlowZoomIn, SlowZoomOut).
 * 
 * Dimensions are guaranteed to be even integers >= output dimensions for FFmpeg codec compatibility.
 */
export function computeCoverFit(
  bgWidth: number,
  bgHeight: number,
  outputWidth: number = OUTPUT_WIDTH,
  outputHeight: number = OUTPUT_HEIGHT
): CoverFitResult {
  if (bgWidth <= 0 || bgHeight <= 0) {
    throw new Error(`Invalid background dimensions: width (${bgWidth}) and height (${bgHeight}) must be positive`);
  }

  const coverScale = Math.max(outputWidth / bgWidth, outputHeight / bgHeight);

  const rawCoveredWidth = Math.ceil(bgWidth * coverScale);
  const rawCoveredHeight = Math.ceil(bgHeight * coverScale);

  // Ensure dimensions are even integers and >= output dimensions
  let coveredWidth = rawCoveredWidth % 2 === 0 ? rawCoveredWidth : rawCoveredWidth + 1;
  let coveredHeight = rawCoveredHeight % 2 === 0 ? rawCoveredHeight : rawCoveredHeight + 1;

  if (coveredWidth < outputWidth) coveredWidth = outputWidth % 2 === 0 ? outputWidth : outputWidth + 1;
  if (coveredHeight < outputHeight) coveredHeight = outputHeight % 2 === 0 ? outputHeight : outputHeight + 1;

  return {
    coverScale,
    coveredWidth,
    coveredHeight,
  };
}

/**
 * Calculates overscanned dimensions for pan presets (PanLeft, PanRight, PanUp, PanDown)
 * by applying panOverscanFactor on top of coverScale.
 * 
 * Guarantees maxPanX > 0 and maxPanY > 0 so that crop expressions have genuine non-degenerate room to pan.
 */
export function computePanOverscan(
  bgWidth: number,
  bgHeight: number,
  outputWidth: number = OUTPUT_WIDTH,
  outputHeight: number = OUTPUT_HEIGHT,
  panOverscanFactor: number = DEFAULT_PAN_OVERSCAN_FACTOR
): PanOverscanResult {
  if (panOverscanFactor <= 1.0) {
    throw new Error(`panOverscanFactor must be strictly greater than 1.0 (received: ${panOverscanFactor})`);
  }

  const { coverScale } = computeCoverFit(bgWidth, bgHeight, outputWidth, outputHeight);
  const finalScale = coverScale * panOverscanFactor;

  const rawScaledWidth = Math.ceil(bgWidth * finalScale);
  const rawScaledHeight = Math.ceil(bgHeight * finalScale);

  let scaledWidth = rawScaledWidth % 2 === 0 ? rawScaledWidth : rawScaledWidth + 1;
  let scaledHeight = rawScaledHeight % 2 === 0 ? rawScaledHeight : rawScaledHeight + 1;

  // Guarantee scaled dimensions exceed output by at least 2 pixels on each axis
  if (scaledWidth <= outputWidth) scaledWidth = outputWidth + 2;
  if (scaledHeight <= outputHeight) scaledHeight = outputHeight + 2;

  const maxPanX = scaledWidth - outputWidth;
  const maxPanY = scaledHeight - outputHeight;

  return {
    coverScale,
    finalScale,
    scaledWidth,
    scaledHeight,
    maxPanX,
    maxPanY,
  };
}
