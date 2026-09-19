import React from 'react';
import { RecoveryPlan, Task, TimeBlock } from '../types';
import { Clock, Coffee, CheckCircle2, AlertCircle, Sparkles, RotateCcw, ArrowRight, ShieldCheck } from 'lucide-react';
import { soundManager } from '../lib/audio';

interface ScheduleTimelineProps {
  plan: RecoveryPlan | null;
  tasks: Task[];
  onOpenAdaptModal: () => void;
  onUpdateStatus: (taskId: string, status: Task['status'], loggedMinutes: number) => void;
  onGeneratePlan: () => void;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
  plan,
  tasks,
  onOpenAdaptModal,
  onUpdateStatus,
  onGeneratePlan,
}) => {
  const taskMap = new Map(tasks.map((t) => [t.taskId, t]));

  if (!plan) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Schedule Generated Yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
          Set your available study capacity on the right and click "Generate AI Recovery Plan" to create your fatigue-aware schedule.
        </p>
        <button
          onClick={onGeneratePlan}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
        >
          <Sparkles className="w-4 h-4 text-indigo-200" />
          <span>Generate Plan Now</span>
        </button>
      </div>
    );
  }

  const deferredTaskList = (plan.deferredTasks || [])
    .map((id) => taskMap.get(id))
    .filter(Boolean) as Task[];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Today's Recovery Schedule
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Plan v{plan.version} {plan.isReplan ? '(Adapted)' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Allocated <span className="font-semibold text-slate-900">{plan.totalAllocatedMinutes}m</span> of focus & reset time
          </p>
        </div>

        <button
          onClick={onOpenAdaptModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-xs transition self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
          <span>Adapt Schedule</span>
        </button>
      </div>

      {/* Synthesis Note */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Bedrock Schedule Note: </span>
          <span>{plan.recoverySummary}</span>
        </div>
      </div>

      {/* Chronological Schedule Blocks */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Chronological Focus Blocks
        </span>

        {plan.timeBlocks.map((block, idx) => {
          const associatedTask = block.taskId ? taskMap.get(block.taskId) : null;
          const isCompleted = associatedTask?.status === 'COMPLETED';

          // 15-Minute Cognitive Reset Break
          if (block.isRest) {
            return (
              <div
                key={block.blockId || idx}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-amber-100 text-amber-700">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-900">{block.title}</span>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded">
                        15 mins
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">{block.actionItem}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded border border-amber-200 flex-shrink-0">
                  {block.startTime} – {block.endTime}
                </span>
              </div>
            );
          }

          // Deep Work Session Block (Max 90m)
          return (
            <div
              key={block.blockId || idx}
              className={`p-3.5 rounded-lg border transition ${
                isCompleted
                  ? 'bg-slate-50/70 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => {
                      if (!block.taskId) return;
                      soundManager.playTaskTick();
                      onUpdateStatus(
                        block.taskId,
                        isCompleted ? 'PENDING' : 'COMPLETED',
                        isCompleted ? 0 : block.durationMinutes
                      );
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 flex-shrink-0 transition ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-indigo-600 bg-white'
                    }`}
                    title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                  >
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold text-slate-900 ${
                          isCompleted ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {block.title}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                        {block.durationMinutes}m focus
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{block.actionItem}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-1 sm:pt-0">
                  <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                    {block.startTime} – {block.endTime}
                  </span>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Deferred Section (Zero Guilt) */}
      {deferredTaskList.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Smart Deferred Tasks (Shifted to Next Window)</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">Zero Guilt Buffer</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To prevent cognitive fatigue and protect high-stakes deadlines, these lower-urgency tasks were automatically deferred rather than overcrowding today's plan:
          </p>
          <div className="divide-y divide-slate-200 border-t border-slate-200 pt-1">
            {deferredTaskList.map((dt) => (
              <div key={dt.taskId} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span className="font-semibold text-slate-800">{dt.title}</span>
                  <span className="text-[10px] text-slate-500">({dt.estMinutes}m)</span>
                </div>
                <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Next Window
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
