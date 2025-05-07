"use client";

import React, { useState } from 'react';
import zoltarsGif from '@/public/images/zoltars.gif';
import { trackEvent } from '@/utils/mixpanel';

const zoltarFortunes = [
  "Congratulations, you now have bad credit.",
  "Zoltar is down for maintenance.",
  "Your destiny is on backorder; please try again later.",
  "Your ambitions have been postponed indefinitely.",
  "The cosmos is currently experiencing a shortage of enthusiasm.",
  "Even your shadow is questioning your potential.",
  "The universe just rescheduled your breakthrough.",
  "Your future is as promising as a cloudy day in November.",
  "Opportunity knocked but left a voicemail instead.",
  "Mediocrity: the one certainty in your future.",
  "Your brilliance is currently buffering.",
  "Today's forecast: 0% chance of success.",
  "The oracle is busy reading the fine print on your fate.",
  "Your luck is so low, even gravity refuses to pull you up.",
  "The universe sent you a memo; it wasn't impressed.",
  "Fate called; it hung up.",
  "Your potential remains lost in translation.",
  "The stars have left you on read.",
  "Your future is currently in a time-out.",
  "Congratulations, you've won another day of mediocrity.",
  "Your enthusiasm seems to have taken a permanent vacation.",
  "Your dreams are currently stuck in traffic.",
  "Fate just hit snooze on your ambitions.",
  "The universe checked your application and returned it unread.",
  "Your potential is under warranty, but expired.",
  "Your future is still loading, please stand by.",
  "The stars predict mediocrity with a chance of disappointment.",
  "Your brilliance is on a coffee break.",
  "Your destiny has been put on ice, permanently.",
  "You might want to consider upgrading your life plan."
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
