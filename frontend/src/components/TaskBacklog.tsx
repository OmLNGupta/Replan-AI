import React, { useState } from 'react';
import { Task } from '../types';
import { Search, CheckCircle2, AlertCircle, Clock, Plus, Filter, RotateCcw } from 'lucide-react';
import { soundManager } from '../lib/audio';

interface TaskBacklogProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, status: Task['status'], loggedMinutes: number) => void;
  onOpenAddTask: () => void;
  onSimulateMissed: (taskId: string) => void;
}

export const TaskBacklog: React.FC<TaskBacklogProps> = ({
  tasks,
  onUpdateStatus,
  onOpenAddTask,
  onSimulateMissed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory =
      categoryFilter === 'all' || t.category === categoryFilter;

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'completed'
        ? t.status === 'COMPLETED'
        : t.status !== 'COMPLETED';

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggleComplete = (task: Task) => {
    soundManager.playTaskTick();
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const logged = nextStatus === 'COMPLETED' ? task.estMinutes : 0;
    onUpdateStatus(task.taskId, nextStatus, logged);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      
      {/* Table Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Task Backlog & Prioritization
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic Engine Formula: <code className="font-mono text-slate-700">0.45 × Urgency + 0.35 × Importance + 0.20 × Difficulty</code>
          </p>
        </div>

        <button
          onClick={onOpenAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks or subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">All Categories</option>
          <option value="College Exam">College Exam</option>
          <option value="Lab / Assignment">Lab / Assignment</option>
          <option value="LeetCode / DSA">LeetCode / DSA</option>
          <option value="Project / System Design">Project / System Design</option>
        </select>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as 'all' | 'pending' | 'completed')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Task Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="pb-2.5 pl-2">Status</th>
              <th className="pb-2.5">Task Title</th>
              <th className="pb-2.5">Category</th>
              <th className="pb-2.5">Deadline</th>
              <th className="pb-2.5 text-center">Duration</th>
              <th className="pb-2.5 text-center">Score</th>
              <th className="pb-2.5 text-center">Priority Tier</th>
              <th className="pb-2.5 text-right pr-2">Disruption Test</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No matching tasks found.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => {
                const isCompleted = t.status === 'COMPLETED';
                const isMissed = t.status === 'MISSED';

                return (
                  <tr
                    key={t.taskId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCompleted ? 'opacity-60 bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 pl-2">
                      <button
                        onClick={() => handleToggleComplete(t)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                          isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isMissed
                            ? 'bg-rose-500 border-rose-500 text-white'
                            : 'border-slate-300 hover:border-indigo-600 bg-white'
                        }`}
                        title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                      >
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        {isMissed && <AlertCircle className="w-3 h-3" />}
                      </button>
                    </td>

                    {/* Title */}
                    <td className="py-3 pr-2 max-w-xs">
                      <span
                        className={`font-semibold text-slate-900 block truncate ${
                          isCompleted ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {t.title}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {t.category}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="py-3 text-slate-600 whitespace-nowrap">
                      {t.hoursUntilDeadline !== undefined ? `${t.hoursUntilDeadline}h left` : '48h'}
                    </td>

                    {/* Duration */}
                    <td className="py-3 text-center text-slate-600 font-mono">
                      {t.estMinutes}m
                    </td>

                    {/* Priority Score */}
                    <td className="py-3 text-center font-mono font-bold text-indigo-600">
                      {t.priorityScore ?? 70.0}
                    </td>

                    {/* Priority Tier */}
                    <td className="py-3 text-center">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          t.tier === 'critical'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : t.tier === 'primary'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.tier || 'primary'}
                      </span>
                    </td>

                    {/* Disruption Simulation Button */}
                    <td className="py-3 text-right pr-2">
                      <button
                        onClick={() => {
                          soundManager.playDisruptionAlert();
                          onSimulateMissed(t.taskId);
                        }}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition border ${
                          isMissed
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200'
                        }`}
                        title="Simulate missed task to trigger adaptive recovery loop"
                      >
                        {isMissed ? 'Marked Missed' : 'Simulate Missed'}
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
