import React from 'react';
import { Clock, CheckCircle2, ListTodo, Zap, TrendingUp } from 'lucide-react';
import { Task } from '../types';

interface QuickStatsProps {
  availableMinutes: number;
  tasks: Task[];
}

export const QuickStats: React.FC<QuickStatsProps> = ({ availableMinutes, tasks }) => {
  const hours = (availableMinutes / 60).toFixed(1);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const activeTasks = tasks.filter((t) => t.status !== 'COMPLETED').length;
  const missedTasks = tasks.filter((t) => t.status === 'MISSED').length;

  const totalEstMinutes = tasks.reduce((acc, t) => acc + (t.estMinutes || 0), 0);
  const totalLoggedMinutes = tasks.reduce((acc, t) => acc + (t.loggedMinutes || 0), 0);

  const focusEfficiency =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* 1. Available Study Time */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 block">Available Study Time</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-slate-900">{hours}h</span>
            <span className="text-xs text-slate-500 font-mono">({availableMinutes}m)</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium mt-1 block">
            Target daily capacity
          </span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* 2. Total Active Tasks */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 block">Active Backlog</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-slate-900">{activeTasks}</span>
            <span className="text-xs text-slate-500">pending</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {missedTasks > 0 ? (
              <span className="text-rose-600 font-medium">{missedTasks} disrupted / missed</span>
            ) : (
              'All prioritized cleanly'
            )}
          </span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
          <ListTodo className="w-5 h-5" />
        </div>
      </div>

      {/* 3. Completed Tasks */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 block">Completed Work</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-600">{completedTasks}</span>
            <span className="text-xs text-slate-500">of {totalTasks} tasks</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            {totalLoggedMinutes}m logged focus time
          </span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* 4. Focus Efficiency */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 block">Focus Efficiency</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-slate-900">{focusEfficiency}%</span>
            <span className="text-xs text-slate-500">completion</span>
          </div>
          <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${focusEfficiency}%` }}
            ></div>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

    </div>
  );
};
