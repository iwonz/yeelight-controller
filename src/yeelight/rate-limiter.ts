interface QueuedPermit {
  resolve: () => void;
  reject: (reason: Error) => void;
}

export class CommandRateLimiter {
  private readonly maxCommands: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];
  private queue: QueuedPermit[] = [];
  private timer: NodeJS.Timeout | null = null;
  private bypassed = false;

  constructor(maxCommands = 60, windowMs = 60000) {
    this.maxCommands = maxCommands;
    this.windowMs = windowMs;
  }

  public acquire(): Promise<void> {
    if (this.bypassed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.drain();
    });
  }

  public cancel(error: Error): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timestamps = [];
    const queue = this.queue;
    this.queue = [];
    queue.forEach((permit) => permit.reject(error));
  }

  public setBypassed(bypassed: boolean): void {
    this.bypassed = bypassed;
    if (!bypassed) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const queue = this.queue;
    this.queue = [];
    queue.forEach((permit) => permit.resolve());
  }

  private drain(): void {
    if (this.bypassed) {
      this.setBypassed(true);
      return;
    }

    const now = Date.now();
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);

    while (this.queue.length > 0 && this.timestamps.length < this.maxCommands) {
      const permit = this.queue.shift();
      this.timestamps.push(now);
      permit?.resolve();
    }

    if (this.queue.length === 0 || this.timer) {
      return;
    }

    const delay = Math.max(1, this.timestamps[0] + this.windowMs - now);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain();
    }, delay);
  }
}
