import React from 'react';
import { 
  Settings as SettingsIcon, 
  Search, 
  FolderPlus, 
  SlidersHorizontal, 
  LineChart, 
  Compass, 
  Layers, 
  History, 
  RotateCcw,
  Sparkles,
  Zap,
  HelpCircle
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onResetChat?: () => void;
  onOpenAbout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onResetChat,
  onOpenAbout
}) => {
  const tabs = [
    { id: 'playground' as ActiveTab, label: 'Playground', color: '#FFE277' }, // Yellow/Cream
    { id: 'capability' as ActiveTab, label: 'Capability Curve', color: '#FF4F84' }, // Pink
    { id: 'blendpilot' as ActiveTab, label: 'BlendPilot', color: '#7C69EF' }, // Purple
    { id: 'benchmarks' as ActiveTab, label: 'Benchmarks', color: '#38E05A' }, // Lime Green
    { id: 'experiments' as ActiveTab, label: 'Experiments', color: '#FFA25B' }, // Orange
    { id: 'settings' as ActiveTab, label: 'Settings', color: '#B8C0D0' }, // Gray
  ];

  return (
    <header className="pt-2 pb-5 border-b-[2.5px] border-black mb-6">
      {/* Top Device Status Bar Row matching screenshot */}
      <div className="flex items-center justify-between pb-4">
        {/* Left: Settings Gear button */}
        <button
          onClick={() => onTabChange('settings')}
          className="w-11 h-11 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] flex items-center justify-center neo-btn hover:bg-[#FFF8E6] transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-5 h-5 text-black" />
        </button>

        {/* Center: Brand Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_#000]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38E05A] border border-black"></span>
          <span className="font-display font-black text-xs uppercase tracking-wider text-black">
            BLEND-LAB
          </span>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          {activeTab === 'playground' && onResetChat && (
            <button
              onClick={onResetChat}
              className="px-3.5 py-2 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] neo-btn flex items-center gap-1.5 text-xs font-black hover:bg-[#FFEAEF]"
              title="Reset prompt"
            >
              <RotateCcw className="w-4 h-4 text-black" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            onClick={onOpenAbout}
            className="h-11 px-3.5 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] flex items-center gap-1.5 text-xs font-black text-black neo-btn hover:bg-[#E5E8FF]"
            title="System Guide"
          >
            <HelpCircle className="w-5 h-5 text-black" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        </div>
      </div>

      {/* Hero Headline (matching "Save now. Find anytime." from screenshot) */}
      <div className="py-2">
        <h1 className="font-display font-black text-3xl sm:text-5xl text-black tracking-tight leading-[1.08]">
          Compare models.<br />
          Find the trade-off.
        </h1>
        <p className="text-xs sm:text-sm font-bold text-[#4A4A4A] mt-1.5">
          Compare local model responses and inspect saved benchmark evidence.
        </p>
      </div>

      {/* Neo-Brutalist Folder Tab Navigation Bar */}
      <nav className="flex items-center gap-2 overflow-x-auto pt-4 pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-2.5 rounded-xl border-2 border-black text-xs font-black whitespace-nowrap transition-all neo-btn ${
                isActive
                  ? 'bg-black text-white shadow-[3px_3px_0px_#000] -translate-y-0.5'
                  : 'bg-white text-black shadow-[3px_3px_0px_#000] hover:bg-[#F4F4F0]'
              }`}
            >
              {/* Little colored folder tab indicator on top */}
              <span 
                className="absolute -top-2 left-3 w-4 h-1.5 rounded-t-sm border-t-2 border-x-2 border-black"
                style={{ backgroundColor: tab.color }}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
