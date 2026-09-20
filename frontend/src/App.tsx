import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuickStats } from './components/QuickStats';
import { HeroBanner } from './components/HeroBanner';
import { ScheduleTimeline } from './components/ScheduleTimeline';
import { CapacityControl } from './components/CapacityControl';
import { TaskBacklog } from './components/TaskBacklog';
import { AnalyticsView } from './components/AnalyticsView';
import { TaskModal } from './components/TaskModal';
import { AdaptModal } from './components/AdaptModal';
import { api } from './lib/api';
import { Task, RecoveryPlan } from './types';
import { soundManager } from './lib/audio';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'backlog' | 'analytics'>('schedule');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableMinutes, setAvailableMinutes] = useState<number>(210); // 3.5 hrs
  const [energyLevel, setEnergyLevel] = useState<'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().slice(0, 10));
  
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isReplanning, setIsReplanning] = useState<boolean>(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [isAdaptModalOpen, setIsAdaptModalOpen] = useState<boolean>(false);

  // Load initial tasks & plan (from DynamoDB backend or local cache)
  useEffect(() => {
    const init = async () => {
      const fetchedTasks = await api.getTasks();
      setTasks(fetchedTasks);
      const latestPlan = await api.getPlan(targetDate);
      if (latestPlan) {
        setPlan(latestPlan);
      }
    };
    init();
  }, [targetDate]);

  // FR-01: Add Task
  const handleAddTask = async (newTaskData: Omit<Task, 'taskId' | 'status' | 'loggedMinutes' | 'createdAt'>) => {
    await api.createTask(newTaskData);
    const updated = await api.getTasks();
    setTasks(updated);
  };

  // FR-04: Progress Tracking
  const handleUpdateStatus = async (taskId: string, status: Task['status'], loggedMinutes: number) => {
    await api.updateTaskProgress(taskId, status, loggedMinutes);
    const refreshed = await api.getTasks();
    setTasks(refreshed);
  };

  // FR-03: Generate AI Recovery Plan
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const newPlan = await api.generatePlan(availableMinutes, targetDate, energyLevel);
      setPlan(newPlan);
    } finally {
      setIsGenerating(false);
    }
  };

  // FR-05: 1-Click Adaptive Replanning Loop
  const handleConfirmReplan = async (
    remainingMinutes: number,
    missedTaskId: string | null,
    reason: string
  ) => {
    setIsReplanning(true);
    try {
      const currentVer = plan ? plan.version : 1;
      const revised = await api.replan(
        remainingMinutes,
        missedTaskId,
        reason,
        currentVer,
        targetDate
      );
      setPlan(revised);
      setAvailableMinutes(remainingMinutes);
      const refreshed = await api.getTasks();
      setTasks(refreshed);
    } finally {
      setIsReplanning(false);
    }
  };

  // Simulate Roadblock / Missed Session Trigger
  const handleSimulateDisruption = () => {
    soundManager.playDisruptionAlert();
    const pendingTask = tasks.find((t) => t.status !== 'COMPLETED');
    if (pendingTask) {
      handleUpdateStatus(pendingTask.taskId, 'MISSED', pendingTask.loggedMinutes);
    }
    setIsAdaptModalOpen(true);
  };

  const handleResetData = () => {
    const reset = api.resetDefaults();
    setTasks(reset);
    setPlan(null);
    setAvailableMinutes(210);
  };

  const hasMissedTasks = tasks.some((t) => t.status === 'MISSED');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      
      {/* Top SaaS Header */}
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAddTask={() => setIsTaskModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 1. Quick Stats Overview (4 KPI Cards) */}
        <QuickStats
          availableMinutes={availableMinutes}
          tasks={tasks}
        />

        {/* 2. Hero Action Banner */}
        <HeroBanner
          hasPlan={!!plan}
          isDisrupted={hasMissedTasks || (plan?.isReplan ?? false)}
          onOpenAdaptModal={() => setIsAdaptModalOpen(true)}
          onSimulateDisruption={handleSimulateDisruption}
        />

        {/* 3. Tab Content */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left / Main Column: Today's Recovery Schedule & Smart Deferred */}
            <div className="lg:col-span-8">
              <ScheduleTimeline
                plan={plan}
                tasks={tasks}
                onOpenAdaptModal={() => setIsAdaptModalOpen(true)}
                onUpdateStatus={handleUpdateStatus}
                onGeneratePlan={handleGeneratePlan}
              />
            </div>

            {/* Right Column: Capacity Control & Quick Actions */}
            <div className="lg:col-span-4 space-y-5">
              <CapacityControl
                availableMinutes={availableMinutes}
                onChangeMinutes={setAvailableMinutes}
                energyLevel={energyLevel}
                onChangeEnergy={setEnergyLevel}
                targetDate={targetDate}
                onChangeDate={setTargetDate}
                onGeneratePlan={handleGeneratePlan}
                onOpenAddTask={() => setIsTaskModalOpen(true)}
                isGenerating={isGenerating}
                hasPlan={!!plan}
              />
            </div>

          </div>
        )}

        {activeTab === 'backlog' && (
          <TaskBacklog
            tasks={tasks}
            onUpdateStatus={handleUpdateStatus}
            onOpenAddTask={() => setIsTaskModalOpen(true)}
            onSimulateMissed={(taskId) => {
              handleUpdateStatus(taskId, 'MISSED', 0);
              setIsAdaptModalOpen(true);
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            tasks={tasks}
            plan={plan}
          />
        )}

      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Replan AI • Intelligent Study Recovery & Workload Rebalancer</span>
          <span className="text-slate-400">Powered by Amazon Bedrock & DynamoDB Single-Table Architecture</span>
        </div>
      </footer>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onAddTask={handleAddTask}
      />

      <AdaptModal
        isOpen={isAdaptModalOpen}
        onClose={() => setIsAdaptModalOpen(false)}
        tasks={tasks}
        currentVersion={plan ? plan.version : 1}
        onConfirmReplan={handleConfirmReplan}
        isReplanning={isReplanning}
      />

    </div>
  );
};
export default App;
