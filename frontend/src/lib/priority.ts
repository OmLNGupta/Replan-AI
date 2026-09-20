import { Task } from '../types';

/**
 * FR-02: Deterministic Priority Engine
 * Mathematical Priority Function:
 * PriorityScore = (0.45 * UrgencyScore) + (0.35 * ImportanceWeight) + (0.20 * DifficultyFactor)
 */

export function calculatePriority(task: Partial<Task>, referenceTime: Date = new Date()): {
  urgencyScore: number;
  importanceWeight: number;
  difficultyFactor: number;
  priorityScore: number;
  tier: 'critical' | 'primary' | 'deferrable';
  hoursUntilDeadline: number;
} {
  // 1. Hours Until Deadline
  let hoursUntilDeadline = 48.0;
  if (task.deadline) {
    try {
      const targetTime = new Date(task.deadline).getTime();
      const diffMs = targetTime - referenceTime.getTime();
      hoursUntilDeadline = Math.max(0, diffMs / (1000 * 60 * 60));
    } catch {
      hoursUntilDeadline = 24.0;
    }
  }

  // UrgencyScore: max(0, 100 - (HoursUntilDeadline * 1.25))
  const urgencyScore = Math.max(0, 100 - hoursUntilDeadline * 1.25);

  // 2. ImportanceWeight: Low (1) -> 25 | Medium (2) -> 60 | High (3) -> 100
  const imp = Number(task.importance || 2);
  let importanceWeight = 60;
  if (imp <= 1) importanceWeight = 25;
  else if (imp === 2) importanceWeight = 60;
  else importanceWeight = 100;

  // 3. DifficultyFactor: Level (1-5) * 20
  const diff = Math.min(5, Math.max(1, Number(task.difficulty || 3)));
  const difficultyFactor = diff * 20;

  // Composite Priority Score
  const rawScore = 0.45 * urgencyScore + 0.35 * importanceWeight + 0.20 * difficultyFactor;
  const priorityScore = Math.round(rawScore * 100) / 100;

  const tier = priorityScore >= 75 ? 'critical' : priorityScore >= 45 ? 'primary' : 'deferrable';

  return {
    urgencyScore: Math.round(urgencyScore * 10) / 10,
    importanceWeight,
    difficultyFactor,
    priorityScore,
    tier,
    hoursUntilDeadline: Math.round(hoursUntilDeadline * 10) / 10,
  };
}

export function enrichAndSortTasks(tasks: Task[]): Task[] {
  const enriched = tasks.map((t) => ({
    ...t,
    ...calculatePriority(t),
  }));

  // Sort descending by priorityScore, then difficultyFactor
  return enriched.sort((a, b) => {
    if ((b.priorityScore || 0) !== (a.priorityScore || 0)) {
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    }
    return (b.difficultyFactor || 0) - (a.difficultyFactor || 0);
  });
}
