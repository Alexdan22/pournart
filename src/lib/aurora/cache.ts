import type { AuroraIntelligenceResponseDto, AuroraRuntimeResultCache } from "@aurora/sdk/integration";

export class BoundedFifoCache implements AuroraRuntimeResultCache {
  private readonly values = new Map<string, AuroraIntelligenceResponseDto>();

  constructor(readonly capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Cache capacity must be positive.");
  }

  get(key: string) {
    return this.values.get(key);
  }

  set(key: string, value: AuroraIntelligenceResponseDto) {
    if (this.values.has(key)) return;
    while (this.values.size >= this.capacity) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }

  get size() {
    return this.values.size;
  }
}
