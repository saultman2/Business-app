export const ACTIVE_JOB_STATUSES = [
  "new",
  "material_list",
  "estimate",
  "estimate_sent",
  "approved",
  "in_progress",
] as const;

const ACTIVE_JOB_STATUS_SET = new Set<string>(ACTIVE_JOB_STATUSES);

export function isActiveJobStatus(status: string): boolean {
  return ACTIVE_JOB_STATUS_SET.has(status);
}
