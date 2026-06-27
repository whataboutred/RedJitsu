/**
 * Light haptic feedback wrappers via the Vibration API.
 *
 * No-op on iOS: Safari has never implemented navigator.vibrate, and the
 * `<input switch>` haptic hack was patched by Apple in iOS 26.5, so there is
 * no reliable web path to the Taptic Engine. These remain for Android and as
 * a clean seam if the app is ever wrapped natively (e.g. Capacitor Haptics).
 */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore — haptics are best-effort
    }
  }
}

/** Quick tick for small interactions (completing a set, toggling). */
export function hapticTap() {
  vibrate(10)
}

/** Stronger double-pulse for successes (workout saved, PR hit). */
export function hapticSuccess() {
  vibrate([100, 50, 100])
}

/** Long celebration pattern for big moments (new personal record). */
export function hapticCelebrate() {
  vibrate([100, 50, 100, 50, 200])
}
