/**
 * polarToCartesian
 * ---
 * math doing math things
 * - Cartesian Coordinates: Across and Up
 * - Polar Coordinates: Distance and Direction
 *
 * https://www.symbolab.com/solver/cartesian-calculator
 **/
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleRad: number,
) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}
