/**
 * Animation Easing Helper (AEN-03, AEN-04, AEN-06)
 * Generates an FFmpeg-expression-syntax substring computing eased progress
 * in [0,1] from a frame-counter variable, using the cubic smoothstep polynomial:
 * S(t) = t^2 * (3 - 2t), where t = varName / denom.
 */
export function smoothstepExpr(varName: string, denom: number): string {
  const t = `(${varName}/${denom})`;
  return `(${t}*${t}*(3-2*${t}))`;
}
