/**
 * Throttle function to limit how often a function can be called
 * Useful for optimizing resize and scroll event handlers
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastRan >= delay) {
      func.apply(this, args);
      lastRan = now;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Ensure delay is non-negative
      const remainingDelay = Math.max(0, delay - (now - lastRan));
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastRan = Date.now();
      }, remainingDelay);
    }
  };
}

/**
 * Debounce function to delay execution until after a certain time has passed
 * Useful for input handlers and API calls
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
