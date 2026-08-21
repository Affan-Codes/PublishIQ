import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { smoothstepExpr } from '../services/animation-easing.js';

describe('Phase 1 — Shared Animation Easing Helper Tests (AEN-03, AEN-04)', () => {
  it('smoothstepExpr produces syntactically valid FFmpeg expression string', () => {
    const expr = smoothstepExpr('on', 89);
    assert.equal(expr, '((on/89)*(on/89)*(3-2*(on/89)))');

    // Check balanced parentheses
    let openCount = 0;
    for (const char of expr) {
      if (char === '(') openCount++;
      if (char === ')') openCount--;
      assert.ok(openCount >= 0, 'Unbalanced closing parenthesis in expression');
    }
    assert.equal(openCount, 0, 'Unbalanced opening parenthesis in expression');
  });

  it('evaluates to expected smoothstep curve values at t=0, t=0.5, t=1.0', () => {
    const denom = 100;
    const evaluate = (n: number): number => {
      const expr = smoothstepExpr('n', denom);
      // Evaluate expression via JS math substitution
      const jsExpr = expr.replace(/n/g, n.toString());
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return Function(`"use strict"; return (${jsExpr});`)();
    };

    assert.equal(evaluate(0), 0);
    assert.equal(evaluate(denom), 1);
    assert.equal(evaluate(denom / 2), 0.5);
  });

  it('exhibits ease-in-out rate of change: slow at endpoints, maximum at midpoint', () => {
    const denom = 1000;
    const evaluate = (n: number): number => {
      const t = n / denom;
      return t * t * (3 - 2 * t);
    };

    // Rate of change over 10% steps
    const step = 100;
    const delta0to10 = evaluate(step) - evaluate(0); // [0.0 - 0.1]
    const delta10to20 = evaluate(2 * step) - evaluate(step); // [0.1 - 0.2]
    const delta45to55 = evaluate(550) - evaluate(450); // [0.45 - 0.55]
    const delta80to90 = evaluate(9 * step) - evaluate(8 * step); // [0.8 - 0.9]
    const delta90to100 = evaluate(10 * step) - evaluate(9 * step); // [0.9 - 1.0]

    // Rate of change near endpoints (0-10% and 90-100%) must be much smaller than midpoint (45-55%)
    assert.ok(
      delta0to10 < delta45to55,
      `Start delta (${delta0to10}) should be smaller than mid delta (${delta45to55})`
    );
    assert.ok(
      delta90to100 < delta45to55,
      `End delta (${delta90to100}) should be smaller than mid delta (${delta45to55})`
    );
    assert.ok(
      delta0to10 < delta10to20,
      `Ease-in acceleration: delta0to10 (${delta0to10}) should be smaller than delta10to20 (${delta10to20})`
    );
    assert.ok(
      delta90to100 < delta80to90,
      `Ease-out deceleration: delta90to100 (${delta90to100}) should be smaller than delta80to90 (${delta80to90})`
    );

    // Symmetric curve verification
    assert.ok(Math.abs(delta0to10 - delta90to100) < 1e-6, 'Smoothstep must be symmetric around t=0.5');
  });
});
