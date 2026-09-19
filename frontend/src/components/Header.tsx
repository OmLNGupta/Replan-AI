import React from 'react';
import { Sparkles, CheckCircle2, Volume2, VolumeX, Plus, RefreshCw } from 'lucide-react';
import { soundManager } from '../lib/audio';

interface HeaderProps {
  activeTab: 'schedule' | 'backlog' | 'analytics';
  onChangeTab: (tab: 'schedule' | 'backlog' | 'analytics') => void;
  onOpenAddTask: () => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onChangeTab,
  onOpenAddTask,
  onResetData,
}) => {
  const [audioEnabled, setAudioEnabled] = React.useState(soundManager.isEnabled());

  const toggleAudio = () => {
    const next = soundManager.toggle();
    setAudioEnabled(next);
    if (next) soundManager.playTaskTick();
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">Replan AI</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md">
                  Study Recovery Coach
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                Adaptive Schedule Restoration & Intelligent Workload Rebalancer
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[
              { id: 'schedule', label: "Today's Schedule" },
              { id: 'backlog', label: 'Task Backlog' },
              { id: 'analytics', label: 'Analytics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id as 'schedule' | 'backlog' | 'analytics')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* System Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>System Online</span>
            </div>

            {/* Audio Synth Toggle */}
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-lg border text-xs font-medium transition ${
                audioEnabled
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
              title={audioEnabled ? 'Audio Synth: Active' : 'Audio Synth: Muted'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Reset Sample Data */}
            <button
              onClick={onResetData}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition"
              title="Reset Sample Tasks"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Add Task Primary CTA */}
            <button
              onClick={onOpenAddTask}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>

          </div>

        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex sm:hidden border-t border-slate-100 py-2 gap-1 overflow-x-auto">
          {[
            { id: 'schedule', label: "Schedule" },
            { id: 'backlog', label: 'Backlog' },
            { id: 'analytics', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id as 'schedule' | 'backlog' | 'analytics')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold text-center transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>
    </header>
  );
};
