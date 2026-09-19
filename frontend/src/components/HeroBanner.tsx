import React from 'react';
import { RotateCcw, AlertCircle, Sparkles, Check, ArrowRight } from 'lucide-react';
import { soundManager } from '../lib/audio';

interface HeroBannerProps {
  hasPlan: boolean;
  isDisrupted: boolean;
  onOpenAdaptModal: () => void;
  onSimulateDisruption: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  hasPlan,
  isDisrupted,
  onOpenAdaptModal,
  onSimulateDisruption,
}) => {
  return (
    <div className="bg-gradient-to-r from-indigo-50 via-white to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Intelligent Schedule Restoration
            </span>
            {isDisrupted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                Schedule Disruption Detected
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            Fell behind or missed a session? Click <span className="text-indigo-600">"Adapt Schedule"</span> to rebalance your remaining work with zero guilt.
          </h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Real life happens. When lab assignments run overtime or exhaustion strikes, Replan AI dynamically recalculates your remaining hours, protects high-stakes exam deadlines, and shifts lower-priority tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:self-start md:self-auto flex-shrink-0">
          
          {/* Simulate Disruption Toggle */}
          <button
            type="button"
            onClick={onSimulateDisruption}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition"
          >
            Simulate Roadblock
          </button>

          {/* Adapt Schedule CTA */}
          <button
            type="button"
            onClick={() => {
              soundManager.playDisruptionAlert();
              onOpenAdaptModal();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Adapt Schedule</span>
          </button>

        </div>

      </div>
    </div>
  );
};
