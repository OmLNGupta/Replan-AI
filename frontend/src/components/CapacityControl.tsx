import React from 'react';
import { Clock, Plus, Zap, BatteryCharging, Sparkles, ArrowRight, Calendar } from 'lucide-react';
import { soundManager } from '../lib/audio';

interface CapacityControlProps {
  availableMinutes: number;
  onChangeMinutes: (mins: number) => void;
  energyLevel: 'HIGH' | 'NORMAL' | 'LOW';
  onChangeEnergy: (level: 'HIGH' | 'NORMAL' | 'LOW') => void;
  targetDate: string;
  onChangeDate: (date: string) => void;
  onGeneratePlan: () => void;
  onOpenAddTask: () => void;
  isGenerating: boolean;
  hasPlan: boolean;
}

export const CapacityControl: React.FC<CapacityControlProps> = ({
  availableMinutes,
  onChangeMinutes,
  energyLevel,
  onChangeEnergy,
  targetDate,
  onChangeDate,
  onGeneratePlan,
  onOpenAddTask,
  isGenerating,
  hasPlan,
}) => {
  const currentHours = (availableMinutes / 60).toFixed(1);

  const handleGenerate = () => {
    soundManager.playPlanGenerated();
    onGeneratePlan();
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Available Capacity & Actions
          </h3>
        </div>
        <button
          onClick={onOpenAddTask}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* 1. Daily Study Capacity Slider (1-8 hours) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">Study Window Today</span>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
            {currentHours} Hours ({availableMinutes} mins)
          </span>
        </div>

        <input
          type="range"
          min="60"
          max="480"
          step="30"
          value={availableMinutes}
          onChange={(e) => onChangeMinutes(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
          {[
            { label: '2h', mins: 120 },
            { label: '3h', mins: 180 },
            { label: '4h', mins: 240 },
            { label: '6h', mins: 360 },
          ].map((preset) => (
            <button
              key={preset.mins}
              onClick={() => onChangeMinutes(preset.mins)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                availableMinutes === preset.mins
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Target Date & Cognitive Energy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
            Target Date
          </label>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
            Energy Level
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'HIGH', label: 'High' },
              { id: 'NORMAL', label: 'Normal' },
              { id: 'LOW', label: 'Low' },
            ].map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onChangeEnergy(e.id as 'HIGH' | 'NORMAL' | 'LOW')}
                className={`py-1.5 text-center text-xs font-medium rounded-lg border transition ${
                  energyLevel === e.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Primary AI Schedule Generator Button */}
      <div className="pt-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating Feasible Schedule...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>{hasPlan ? 'Rebalance Full Schedule' : 'Generate AI Recovery Plan'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Strictly caps focus blocks to 90 mins with mandatory 15m cognitive breaks.
        </p>
      </div>

    </div>
  );
};
