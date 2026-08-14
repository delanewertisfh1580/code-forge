import rawPrimitives from "../../primitives.json";
import type { Primitives } from "../lib/types";
import { validatePrimitives } from "../lib/validation";

export const primitivesValidation = validatePrimitives(rawPrimitives);

if (!primitivesValidation.valid) {
  const details = primitivesValidation.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  throw new Error(`Invalid primitives.json: ${details}`);
}

export const primitives = rawPrimitives as Primitives;

export function getMonthlyFixedCosts(): number {
  return Object.values(primitives.operating_costs_monthly).reduce((sum, value) => sum + value, 0);
}
