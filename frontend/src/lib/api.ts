import { Task, RecoveryPlan, DailyContext, TimeBlock } from '../types';
import { calculatePriority, enrichAndSortTasks } from './priority';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';

const STORAGE_KEY_TASKS = 'replan_ai_tasks_v1';
const STORAGE_KEY_PLAN = 'replan_ai_plan_v1';

// Initial default seed tasks (matching PRD & TRD engineering specs)
export const SEED_TASKS: Task[] = [
  {
    taskId: 'task-uuid-1',
    title: 'Binary Search Trees & LeetCode Tree Traversal',
    category: 'LeetCode / DSA',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    importance: 3,
    difficulty: 4,
    estMinutes: 90,
    status: 'PENDING',
    loggedMinutes: 0,
    createdAt: new Date().toISOString()
  },
  {
    taskId: 'task-uuid-2',
    title: 'DBMS Normalization (3NF & BCNF Proofs)',
    category: 'College Exam',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    importance: 2,
    difficulty: 3,
    estMinutes: 60,
    status: 'PENDING',
    loggedMinutes: 0,
    createdAt: new Date().toISOString()
  },
  {
    taskId: 'task-uuid-3',
    title: 'Web Architecture & Cloud API Gateway Lab',
    category: 'Project / Lab',
    deadline: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
    importance: 1,
    difficulty: 2,
    estMinutes: 45,
    status: 'PENDING',
    loggedMinutes: 0,
    createdAt: new Date().toISOString()
  }
];

function getStoredTasks(): Task[] {
  if (typeof window === 'undefined') return SEED_TASKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(SEED_TASKS));
      return SEED_TASKS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_TASKS;
  }
}

function saveStoredTasks(tasks: Task[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  }
}

function generateLocalRecoveryPlan(
  tasks: Task[],
  availableMinutes: number,
  targetDate: string,
  version: number = 1,
  disruptionReason?: string
): RecoveryPlan {
  const prioritized = enrichAndSortTasks(tasks);
  const timeBlocks: TimeBlock[] = [];
  const deferredTasks: string[] = [];

  let allocatedMinutes = 0;
  let remaining = availableMinutes;
  let curHour = 17;
  let curMin = 0;
  let blockCounter = 1;

  const fmtTime = (h: number, m: number) => {
    const hh = String(h % 24).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  for (const t of prioritized) {
    if (t.status === 'COMPLETED') continue;

    if (remaining <= 0) {
      deferredTasks.push(t.taskId);
      continue;
    }

    const taskChunk = Math.min(t.estMinutes || 60, 90, remaining);
    if (taskChunk < 20 && remaining < 30 && timeBlocks.length > 0) {
      deferredTasks.push(t.taskId);
      continue;
    }

    const startTime = fmtTime(curHour, curMin);
    const totEnd = curHour * 60 + curMin + taskChunk;
    const endH = Math.floor(totEnd / 60);
    const endM = totEnd % 60;
    const endTime = fmtTime(endH, endM);

    timeBlocks.push({
      blockId: `b${blockCounter++}`,
      taskId: t.taskId,
      title: t.title,
      startTime,
      endTime,
      durationMinutes: taskChunk,
      actionItem: `Deep focus on ${t.category}: core concepts & exercises (${taskChunk}m)`,
      isRest: false,
      difficulty: t.difficulty,
      tier: t.tier
    });

    allocatedMinutes += taskChunk;
    remaining -= taskChunk;
    curHour = endH;
    curMin = endM;

    if (remaining >= 30) {
      const restStart = fmtTime(curHour, curMin);
      const totRestEnd = curHour * 60 + curMin + 15;
      const rEndH = Math.floor(totRestEnd / 60);
      const rEndM = totRestEnd % 60;
      const restEnd = fmtTime(rEndH, rEndM);

      timeBlocks.push({
        blockId: `b${blockCounter++}`,
        taskId: null,
        title: 'Cognitive Reset Break',
        startTime: restStart,
        endTime: restEnd,
        durationMinutes: 15,
        actionItem: 'Hydrate, rest eyes, and stretch; avoid digital screens',
        isRest: true,
        difficulty: 1,
        tier: 'rest'
      });

      allocatedMinutes += 15;
      remaining -= 15;
      curHour = rEndH;
      curMin = rEndM;
    }
  }

  const prefix = disruptionReason ? `Adaptive Replan (${disruptionReason}): ` : '';
  const defMsg = deferredTasks.length > 0 ? ` Deferred ${deferredTasks.length} lower-urgency task(s) to protect focus.` : ' All pending tasks fit into capacity.';
  const recoverySummary = `${prefix}Allocated ${allocatedMinutes}m of ${availableMinutes}m available.${defMsg} Enforces 90m deep work limits and cognitive reset intervals.`;

  return {
    planId: `plan-${Date.now().toString(36)}`,
    targetDate,
    version,
    totalAllocatedMinutes: allocatedMinutes,
    timeBlocks,
    deferredTasks,
    recoverySummary,
    isReplan: !!disruptionReason,
    generatedAt: new Date().toISOString()
  };
}

export const api = {
  // FR-01: Ingest & List Tasks
  getTasks: async (userId: string = 'student-001'): Promise<Task[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/tasks?userId=${encodeURIComponent(userId)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) {
          saveStoredTasks(data.tasks);
          return enrichAndSortTasks(data.tasks);
        }
      }
    } catch {
      // Offline fallback
    }
    const local = getStoredTasks();
    return enrichAndSortTasks(local);
  },

  createTask: async (
    taskData: Omit<Task, 'taskId' | 'status' | 'loggedMinutes' | 'createdAt'>,
    userId: string = 'student-001'
  ): Promise<Task> => {
    const newTask: Task = {
      ...taskData,
      taskId: `task-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      status: 'PENDING',
      loggedMinutes: 0,
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          const current = getStoredTasks();
          saveStoredTasks([data.task, ...current]);
          return { ...data.task, ...calculatePriority(data.task) };
        }
      }
    } catch {
      // Local fallback
    }

    const current = getStoredTasks();
    const updated = [newTask, ...current];
    saveStoredTasks(updated);
    return { ...newTask, ...calculatePriority(newTask) };
  },

  // FR-04: Progress Tracking
  updateTaskProgress: async (
    taskId: string,
    status: Task['status'],
    loggedMinutes: number,
    userId: string = 'student-001'
  ): Promise<Task[]> => {
    try {
      await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, loggedMinutes }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      // Offline
    }

    const current = getStoredTasks();
    const updated = current.map((t) => (t.taskId === taskId ? { ...t, status, loggedMinutes } : t));
    saveStoredTasks(updated);
    return updated;
  },

  // Fetch Latest Plan from DynamoDB
  getPlan: async (dateStr: string, userId: string = 'student-001'): Promise<RecoveryPlan | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/plan?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateStr)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(data.plan));
          }
          return data.plan;
        }
      }
    } catch {
      // Fallback to local cached plan
    }

    return api.getCachedPlan();
  },

  // FR-03: AI Recovery Plan Generation (Strictly Version 1)
  generatePlan: async (
    availableMinutes: number,
    dateStr: string,
    energyLevel: string = 'NORMAL',
    userId: string = 'student-001'
  ): Promise<RecoveryPlan> => {
    try {
      const res = await fetch(`${API_BASE_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date: dateStr, availableMinutes, energyLevel }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const plan = await res.json();
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan));
        }
        return plan;
      }
    } catch {
      // Resilient fallback
    }

    const tasks = getStoredTasks();
    const plan = generateLocalRecoveryPlan(tasks, availableMinutes, dateStr, 1);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan));
    }
    return plan;
  },

  // FR-05: Adaptive Replanning Loop (Bumps to Version 2+)
  replan: async (
    remainingMinutes: number,
    missedTaskId: string | null,
    disruptionReason: string,
    currentVersion: number,
    dateStr: string,
    userId: string = 'student-001'
  ): Promise<RecoveryPlan> => {
    try {
      const res = await fetch(`${API_BASE_URL}/plan/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date: dateStr,
          missedTaskId,
          remainingAvailableMinutes: remainingMinutes,
          currentVersion,
          disruptionReason
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const plan = await res.json();
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan));
        }
        return plan;
      }
    } catch {
      // Resilient fallback
    }

    if (missedTaskId) {
      const tasks = getStoredTasks().map((t) => (t.taskId === missedTaskId ? { ...t, status: 'MISSED' as const } : t));
      saveStoredTasks(tasks);
    }
    const tasks = getStoredTasks();
    const nextVer = currentVersion + 1;
    const plan = generateLocalRecoveryPlan(tasks, remainingMinutes, dateStr, nextVer, disruptionReason);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan));
    }
    return plan;
  },

  getCachedPlan: (): RecoveryPlan | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLAN);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  resetDefaults: (): Task[] => {
    saveStoredTasks(SEED_TASKS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PLAN);
    }
    return enrichAndSortTasks(SEED_TASKS);
  }
};
