import React, { useState } from 'react';
import { X, RotateCcw, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { Task } from '../types';
import { soundManager } from '../lib/audio';

interface AdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  currentVersion: number;
  onConfirmReplan: (remainingMinutes: number, missedTaskId: string | null, reason: string) => void;
  isReplanning: boolean;
}

export const AdaptModal: React.FC<AdaptModalProps> = ({
  isOpen,
  onClose,
  tasks,
  currentVersion,
  onConfirmReplan,
  isReplanning,
}) => {
  const [reason, setReason] = useState('Unexpected lab assignment ran overtime');
  const [remainingMinutes, setRemainingMinutes] = useState(90);
  const [selectedMissedTask, setSelectedMissedTask] = useState<string>(
    tasks.find((t) => t.status === 'MISSED')?.taskId || tasks[0]?.taskId || ''
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playPlanGenerated();
    onConfirmReplan(remainingMinutes, selectedMissedTask || null, reason);
    onClose();
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Adapt Study Schedule</h3>
              <p className="text-xs text-slate-500">
                1-Click Recovery Rebalance (Plan v{currentVersion} → v{currentVersion + 1})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          
          {/* Disruption Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Disruption Cause
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            >
              <option value="Unexpected lab assignment ran overtime">
                Unexpected college lab ran overtime
              </option>
              <option value="Roadblock on difficult algorithm consumed unplanned hours">
                Roadblock on difficult algorithm consumed unplanned hours
              </option>
              <option value="Fatigue & low cognitive energy: need reduced study hours">
                Fatigue & low energy: need reduced study hours
              </option>
              <option value="Personal disruption or unplanned errand">
                Personal disruption or unplanned errand
              </option>
            </select>
          </div>

          {/* Missed Task */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Interrupted / Missed Task (Optional)
            </label>
            <select
              value={selectedMissedTask}
              onChange={(e) => setSelectedMissedTask(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            >
              <option value="">None / General Time Disruption Only</option>
              {pendingTasks.map((t) => (
                <option key={t.taskId} value={t.taskId}>
                  {t.title} ({t.estMinutes}m) • Priority: {t.priorityScore}
                </option>
              ))}
            </select>
          </div>

          {/* New Available Study Window */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Remaining Study Capacity Today
              </label>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {Math.floor(remainingMinutes / 60)}h {remainingMinutes % 60}m ({remainingMinutes} mins)
              </span>
            </div>

            <input
              type="range"
              min="30"
              max="240"
              step="15"
              value={remainingMinutes}
              onChange={(e) => setRemainingMinutes(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />

            <div className="flex gap-2 mt-2">
              {[45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRemainingMinutes(m)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium border transition ${
                    remainingMinutes === m
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Zero-Guilt Assurance */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-900">Guilt-Free Rebalance: </span>
              <span>
                Missing a session is a natural feedback signal. Lower-priority tasks will be safely deferred to prevent cognitive overload.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReplanning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
            >
              {isReplanning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Rebalancing Schedule...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Execute Guilt-Free Recovery</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
