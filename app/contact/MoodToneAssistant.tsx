import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPeace, faSmile, faFrown, faAngry, faLaugh, faHandshake } from '@fortawesome/free-solid-svg-icons';
import { trackEvent } from '@/utils/mixpanel';

interface MoodToneAssistantProps {
  currentText: string;
  onEnhance: (mood: string, tone: string) => void;
  onDefaultEnhance: () => void;
  onClose: () => void;
}

const MoodToneAssistant: React.FC<MoodToneAssistantProps> = ({ onEnhance, onDefaultEnhance, onClose }) => {
  const [selectedMood, setSelectedMood] = useState('Neutral');
  const [selectedTone, setSelectedTone] = useState('Formal');
  const [customMood, setCustomMood] = useState('');
  const [customTone, setCustomTone] = useState('');

  const handleMoodChange = (value: string) => {
    setSelectedMood(value);
    setCustomMood('');
  };

  const handleToneChange = (value: string) => {
    setSelectedTone(value);
    setCustomTone('');
  };

  const handleCustomMoodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomMood(event.target.value);
    setSelectedMood('Custom');
  };

  const handleCustomToneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTone(event.target.value);
    setSelectedTone('Custom');
  };

  // Determine final mood and tone values
  const finalMood = selectedMood === 'Custom' ? customMood : selectedMood;
  const finalTone = selectedTone === 'Custom' ? customTone : selectedTone;

  const handleEnhanceClick = () => {
    trackEvent('MoodTone Enhance Button Clicked', { mood: finalMood, tone: finalTone });
    onEnhance(finalMood, finalTone);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-brand-900 rounded p-6 w-full max-w-md">
        <div className="flex justify-end">
          <button className="text-gray-700 dark:text-gray-300 text-2xl" onClick={onClose}>
            &times;
          </button>
        </div>
        <h2 className="text-xl font-semibold mb-4 text-center"></h2>
        {/* Default enhance button */}
        <button
          id="centeringClass"
          className="btn btn-primary w-full py-2 rounded bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:bg-indigo-700 transition mb-4"
          type="button"
          onClick={() => { trackEvent('Default Enhance Button Clicked'); onDefaultEnhance(); }}
        >
          Enhance as a professional message
        </button>
        <p className="text-center text-sm text-gray-500 mb-4">OR</p>
        <div className="mb-4">
          <label className="font-medium block mb-1 text-center">Select a Mood:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Neutral' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Neutral')}
            >
              <FontAwesomeIcon icon={faPeace} className="mr-1" /> Neutral
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Happy' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Happy')}
            >
              <FontAwesomeIcon icon={faSmile} className="mr-1" /> Happy
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Sad' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Sad')}
            >
              <FontAwesomeIcon icon={faFrown} className="mr-1" /> Sad
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Angry' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Angry')}
            >
              <FontAwesomeIcon icon={faAngry} className="mr-1" /> Angry
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Excited' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Excited')}
            >
              <FontAwesomeIcon icon={faLaugh} className="mr-1" /> Excited
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedMood === 'Concerned' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleMoodChange('Concerned')}
            >
              <FontAwesomeIcon icon={faHandshake} className="mr-1" /> Concerned
            </button>
          </div>
         
        </div>
        <div className="mb-4">
          <label className="font-medium block mb-1 text-center">Select a Tone:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Formal' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Formal')}
            >
              Formal
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Informal' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Informal')}
            >
              Informal
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Friendly' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Friendly')}
            >
              Friendly
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Serious' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Serious')}
            >
              Serious
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Humorous' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Humorous')}
            >
              Humorous
            </button>
            <button
              type="button"
              className={`p-2 rounded ${selectedTone === 'Respectful' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => handleToneChange('Respectful')}
            >
              Respectful
            </button>
          </div>
         
        </div>
        <button
          type="button"
          className="btn btn-primary w-full py-2 rounded bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:bg-indigo-700 transition"
          onClick={handleEnhanceClick}
        >
          Enhance with chosen Mood and Tone
        </button>
      </div>
    </div>
  );
};

export default MoodToneAssistant;
