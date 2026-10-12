export interface ResourceSnapshot { physicalAvailableBytes: number; commitAvailableBytes?: number | null; logicalCPUs?: number; provider?: string; development?: Array<{pid: number; role: string}> }
export interface ResourcePlan { workers: number; allowed: boolean; reasons: string[]; minimumAvailableMiB: number; [key: string]: unknown }
export function readMemorySnapshotSync(): ResourceSnapshot;
export function chooseResourceBudget(snapshot: ResourceSnapshot, options?: {kind?: string; focused?: boolean; env?: NodeJS.ProcessEnv; heapLimitMiB?: number}): ResourcePlan;
export function workerEnvironment(plan: ResourcePlan, env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export function positiveInteger(value: string | undefined, name: string): number | undefined;
