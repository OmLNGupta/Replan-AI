import React, { useState } from 'react';
import { X, Plus, Calculator, Sparkles } from 'lucide-react';
import { Task } from '../types';
import { calculatePriority } from '../lib/priority';
import { soundManager } from '../lib/audio';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (taskData: Omit<Task, 'taskId' | 'status' | 'loggedMinutes' | 'createdAt'>) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onAddTask }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('College Exam');
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [importance, setImportance] = useState(2);
  const [difficulty, setDifficulty] = useState(3);
  const [estMinutes, setEstMinutes] = useState(60);

  if (!isOpen) return null;

  const preview = calculatePriority({
    title,
    category,
    deadline: new Date(deadline).toISOString(),
    importance,
    difficulty,
    estMinutes,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundManager.playTaskTick();
    onAddTask({
      title: title.trim(),
      category,
      deadline: new Date(deadline).toISOString(),
      importance,
      difficulty,
      estMinutes: Number(estMinutes),
    });

    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add Study Task</h3>
            <p className="text-xs text-slate-500">
              FR-01: Ingest parameters into deterministic priority engine
            </p>
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
          
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Dynamic Programming & Graph Traversal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            />
          </div>

          {/* Category & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              >
                <option value="College Exam">College Exam</option>
                <option value="Lab / Assignment">Lab / Assignment</option>
                <option value="LeetCode / DSA">LeetCode / DSA</option>
                <option value="Project / System Design">Project / System Design</option>
                <option value="Coding">Coding</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Deadline
              </label>
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Importance & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Importance Weight (FR-02)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Low (1)', val: 1, wt: 25 },
                  { label: 'Med (2)', val: 2, wt: 60 },
                  { label: 'High (3)', val: 3, wt: 100 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setImportance(item.val)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                      importance === item.val
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Difficulty (1–5)
                </label>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  Level {difficulty} ({difficulty * 20} pts)
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1: Straightforward</span>
                <span>3: Moderate</span>
                <span>5: Heavy</span>
              </div>
            </div>
          </div>

          {/* Estimated Minutes */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Estimated Duration
              </label>
              <span className="text-xs font-mono font-bold text-slate-800">{estMinutes} mins</span>
            </div>
            <div className="flex gap-2">
              {[30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setEstMinutes(mins)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition ${
                    estMinutes === mins
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Priority Formula Calculation Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                Live Priority Math
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  preview.tier === 'critical'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : preview.tier === 'primary'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {preview.tier} Tier
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-1.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-400">Urgency (0.45)</div>
                <div className="font-mono font-bold text-slate-800">{preview.urgencyScore}</div>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-400">Weight (0.35)</div>
                <div className="font-mono font-bold text-slate-800">{preview.importanceWeight}</div>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200">
                <div className="text-[10px] text-slate-400">Diff (0.20)</div>
                <div className="font-mono font-bold text-slate-800">{preview.difficultyFactor}</div>
              </div>
              <div className="bg-indigo-50 p-1.5 rounded border border-indigo-200">
                <div className="text-[10px] text-indigo-600 font-semibold">Priority Score</div>
                <div className="font-mono font-extrabold text-indigo-700">{preview.priorityScore}</div>
              </div>
            </div>
          </div>

          {/* Submit */}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save to Backlog</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
