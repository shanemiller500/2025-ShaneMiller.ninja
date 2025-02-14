"use client";

import React, { useState } from 'react';
import zoltarsGif from '@/public/images/zoltars.gif';
import { trackEvent } from '@/utils/mixpanel';

const zoltarFortunes = [
  "A thrilling adventure awaits you; embrace the unknown.",
  "Today is your lucky day—fortune favors the bold.",
  "Mystery and magic are about to grace your life.",
  "An unexpected encounter will change your perspective.",
  "Your talents will soon shine like a brilliant star.",
  "Love is on the horizon; be ready to receive its gifts.",
  "The path to success is paved with determination.",
  "Great rewards come from taking risks—dare to dream.",
  "A surprise twist in your journey will bring joy.",
  "Your intuition will guide you through turbulent times.",
  "You are destined for greatness; seize the moment.",
  "A treasure trove of opportunity awaits you.",
  "Your smile will be your secret weapon in the days ahead.",
  "Courage is the key that unlocks hidden doors.",
  "Embrace the unexpected; magic is just around the corner.",
  "A challenge will soon reveal your inner strength.",
  "Happiness is found in the little moments—cherish them.",
  "Your creative spirit will lead to innovative breakthroughs.",
  "Adventure beckons—step out of your comfort zone.",
  "Fortune smiles upon those who persist in the face of adversity.",
  "The winds of change are blowing—surrender to their guidance.",
  "In the realm of dreams, your desires take flight.",
  "Luck is a journey, not a destination—enjoy every step.",
  "Your heart holds the key to unlocking life's mysteries.",
  "The stars align in your favor; trust in the universe.",
  "A whisper of destiny calls your name—listen carefully.",
  "Your future glows with promise and potential.",
  "A moment of clarity will reveal the answers you seek.",
  "Embrace your uniqueness; it's your greatest strength.",
  "Your destiny is written in the stars—believe in the magic.",
  "A playful surprise is on its way; expect the unexpected.",
  "Your journey is just beginning; prepare for wonder.",
  "A friend from the past reappears to offer guidance.",
  "Patience and perseverance will open new doors.",
  "The magic of the moment is yours—capture it with joy."
];

const Zoltars: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [fortune, setFortune] = useState('');

  const handleClick = () => {
    const randomIndex = Math.floor(Math.random() * zoltarFortunes.length);
    const selectedFortune = zoltarFortunes[randomIndex];
    setFortune(selectedFortune);
    setShowPopup(true);
    // Track the fortune revealed event
    trackEvent("Fortune Revealed", { fortune: selectedFortune });
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    // Track the popup closed event
    trackEvent("Fortune Popup Closed");
  };

  return (
    <>
      {/* Zoltar Machine with Full Background */}
      <div
        onClick={handleClick}
        className="cursor-pointer relative rounded-lg border-4 border-yellow-500 shadow-2xl hover:shadow-3xl transition-shadow duration-300 overflow-hidden h-96"
        style={{ 
          backgroundImage: `url(${zoltarsGif.src})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center' 
        }}
      >
        {/* Overlay for text clarity */}
        <div className="absolute inset-0 bg-red-900 bg-opacity-60 flex flex-col items-center justify-center">
          <h1 className="text-center text-yellow-200 text-5xl font-extrabold mb-4 boom">
            Zoltar
          </h1>
          <p className="text-center text-yellow-200 text-lg">
            Tap to reveal your fortune...
          </p>
          <p className="text-center text-yellow-200 text-lg">
           If you dare...
          </p>
        </div>
      </div>

      {/* Fortune Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={handleClosePopup}
        >
          <div
            className="bg-red-900 p-8 rounded-lg border-4 border-yellow-500 shadow-lg max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4 text-yellow-300 boom">
              Zoltar's Fortune
            </h2>
            <p className="text-white mb-4">{fortune}</p>
            <button
              className="mt-2 px-4 py-2 bg-yellow-500 text-red-900 font-semibold rounded hover:bg-yellow-600"
              onClick={handleClosePopup}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CSS for the “boom” animation */}
      <style jsx>{`
        @keyframes boom {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.4);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }
        .boom {
          animation: boom 0.7s ease-out;
        }
      `}</style>
    </>
  );
};

export default Zoltars;
