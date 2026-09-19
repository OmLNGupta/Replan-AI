import React from 'react';
import { Task, RecoveryPlan } from '../types';
import { BarChart3, PieChart, TrendingUp, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface AnalyticsViewProps {
  tasks: Task[];
  plan: RecoveryPlan | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks, plan }) => {
  const totalTasks = tasks.length;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const missed = tasks.filter((t) => t.status === 'MISSED').length;
  const pending = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'MISSED').length;

  const categories = Array.from(new Set(tasks.map((t) => t.category)));
  const categoryCounts = categories.map((cat) => ({
    name: cat,
    count: tasks.filter((t) => t.category === cat).length,
    completed: tasks.filter((t) => t.category === cat && t.status === 'COMPLETED').length,
  }));

  const totalLogged = tasks.reduce((acc, t) => acc + (t.loggedMinutes || 0), 0);
  const totalEst = tasks.reduce((acc, t) => acc + (t.estMinutes || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Productivity Rate
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-500">of tasks completed</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1">
            {completed} completed • {pending} in progress
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Focus Time Logged
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-indigo-600">{totalLogged}m</span>
            <span className="text-xs text-slate-500 font-mono">/ {totalEst}m planned</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {(totalLogged / 60).toFixed(1)} hrs of deep focus recorded
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Adaptive Resilience
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-900">
              Plan v{plan ? plan.version : 1}
            </span>
            <span className="text-xs text-indigo-600 font-medium">active schedule</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {plan?.isReplan ? 'Dynamic recovery active' : 'Initial schedule locked'}
          </p>
        </div>
      </div>

      {/* Category Breakdown & Difficulty Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Category Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Workload by Category
              </h4>
            </div>
          </div>

          <div className="space-y-3">
            {categoryCounts.map((cat) => {
              const pct = totalTasks > 0 ? Math.round((cat.count / totalTasks) * 100) : 0;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{cat.name}</span>
                    <span className="text-slate-500">{cat.completed}/{cat.count} done ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cognitive Load Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cognitive Rules Compliance
              </h4>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-900 block mb-0.5">
                90-Minute Deep Work Constraint
              </span>
              <p className="text-slate-500 text-[11px]">
                Tasks longer than 90m are automatically partitioned into manageable sub-blocks to prevent cognitive fatigue.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-900 block mb-0.5">
                Mandatory 15-Minute Reset Breaks
              </span>
              <p className="text-slate-500 text-[11px]">
                Rest intervals are automatically inserted between intensive blocks to recharge attention and eye stamina.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-900 block mb-0.5">
                Zero-Guilt Task Deferrals
              </span>
              <p className="text-slate-500 text-[11px]">
                Overflowing tasks are deferred to the next window instead of squeezing them into unrealistic timetables.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
