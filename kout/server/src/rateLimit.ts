/** Token bucket: `capacity` messages at once, refilled at `perSecond`. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  constructor(
    private capacity = 12,
    private perSecond = 6,
    private now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }
  /** true if the message may go through */
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
