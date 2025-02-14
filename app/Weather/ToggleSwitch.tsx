// app/Weather/ToggleSwitch.tsx

import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => {
  return (
    <label className="flex items-center cursor-pointer select-none">
      <span className="mr-2 dark:text-white text-brand-900 font-medium">
        {isOn ? '°F' : '°C'}
      </span>
      <div className="relative">
        <input
          type="checkbox"
          checked={isOn}
          onChange={onToggle}
          className="sr-only"
        />
        <div className="w-10 h-4 bg-indigo-400 rounded-full shadow-inner"></div>
        <div
          className={`dot absolute w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ease-in-out -top-1 -left-1 ${
            isOn ? 'transform translate-x-full bg-indigo-600' : ''
          }`}
        ></div>
      </div>
    </label>
  );
};

export default ToggleSwitch;
