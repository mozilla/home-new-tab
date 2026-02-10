/**
 * Crypto Mocking Utilities - Deterministic UUID generation for tests
 *
 * Provides utilities for mocking crypto.randomUUID() to generate
 * deterministic tab IDs in tests. This is critical for testing
 * cross-tab sync scenarios where tab identity matters.
 */

/**
 * Mock crypto.randomUUID with a deterministic sequence
 *
 * Replaces globalThis.crypto.randomUUID with a function that returns
 * UUIDs from a predefined sequence. Useful for creating predictable
 * tab IDs in multi-tab simulation tests.
 *
 * @param uuidSequence - Array of UUIDs to return in order
 *
 * Usage:
 * ```typescript
 * mockCrypto(['tab-a-uuid', 'tab-b-uuid', 'tab-c-uuid'])
 *
 * // First call returns 'tab-a-uuid'
 * // Second call returns 'tab-b-uuid'
 * // etc.
 * ```
 *
 * @returns Cleanup function to restore original crypto
 */
export function mockCrypto(uuidSequence: string[]): () => void {
  const originalCrypto = globalThis.crypto
  let index = 0

  // Create a mock crypto object
  const mockCryptoObj = {
    ...originalCrypto,
    randomUUID: () => {
      if (index >= uuidSequence.length) {
        throw new Error(
          `mockCrypto: Ran out of UUIDs. Provided ${uuidSequence.length}, but ${index + 1} were requested.`,
        )
      }
      return uuidSequence[index++]
    },
  }

  // Replace global crypto
  Object.defineProperty(globalThis, "crypto", {
    value: mockCryptoObj,
    writable: true,
    configurable: true,
  })

  // Return cleanup function
  return () => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
      configurable: true,
    })
  }
}

/**
 * Remove crypto entirely to test fallback behavior
 *
 * Useful for testing that the system falls back gracefully
 * when crypto.randomUUID is not available (older browsers).
 *
 * @returns Cleanup function to restore original crypto
 */
export function removeCrypto(): () => void {
  const originalCrypto = globalThis.crypto

  Object.defineProperty(globalThis, "crypto", {
    value: undefined,
    writable: true,
    configurable: true,
  })

  return () => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
      configurable: true,
    })
  }
}
