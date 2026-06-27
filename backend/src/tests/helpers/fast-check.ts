import fc from 'fast-check';

/**
 * Default fast-check configuration for property-based tests.
 * Minimum 100 iterations per property as per the design specification.
 */
export const FC_DEFAULT_NUM_RUNS = 100;

/**
 * Re-export fast-check for convenience.
 * Use this throughout the test suite for consistency.
 */
export { fc };

/**
 * Run a property-based assertion with the project's default configuration.
 * Ensures minimum 100 runs per property.
 */
export function assertProperty(
  property: fc.IProperty<unknown> | fc.IAsyncProperty<unknown>,
  params?: Partial<fc.Parameters<unknown>>
): void | Promise<void> {
  return fc.assert(property, { numRuns: FC_DEFAULT_NUM_RUNS, ...params });
}
