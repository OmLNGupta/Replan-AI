export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED';

export interface Task {
  taskId: string;
  userId?: string;
  title: string;
  category: string;
  deadline: string;
  importance: number; // 1: Low, 2: Medium, 3: High
  difficulty: number; // 1 to 5
  estMinutes: number;
  status: TaskStatus;
  loggedMinutes: number;
  createdAt: string;
  
  // Computed Deterministic Priority Metrics
  urgencyScore?: number;
  importanceWeight?: number;
  difficultyFactor?: number;
  priorityScore?: number;
  tier?: 'critical' | 'primary' | 'deferrable';
  hoursUntilDeadline?: number;
}

export interface TimeBlock {
  blockId: string;
  taskId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  actionItem: string;
  isRest: boolean;
  difficulty?: number;
  tier?: string;
}

export interface RecoveryPlan {
  planId: string;
  targetDate: string;
  version: number;
  totalAllocatedMinutes: number;
  timeBlocks: TimeBlock[];
  deferredTasks: string[];
  recoverySummary: string;
  isReplan?: boolean;
  generatedAt: string;
}

export interface DailyContext {
  availableMinutes: number;
  preferredTimeWindow: {
    start: string;
    end: string;
  };
  energyLevel: 'HIGH' | 'NORMAL' | 'LOW';
  targetDate: string;
}
