import type { PublicJob } from "./types";

export interface JobStore {
  save(job: PublicJob): void;
  get(id: string): PublicJob | null;
}

export function createJobStore(limit = 200): JobStore {
  const jobs = new Map<string, PublicJob>();
  const order: string[] = [];
  return {
    save(job) {
      if (!jobs.has(job.id)) {
        order.push(job.id);
        while (order.length > limit) {
          const oldest = order.shift();
          if (oldest) jobs.delete(oldest);
        }
      }
      jobs.set(job.id, job);
    },
    get(id) {
      return jobs.get(id) ?? null;
    },
  };
}
