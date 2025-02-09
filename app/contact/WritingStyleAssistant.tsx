import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { trackEvent } from '@/utils/mixpanel';

interface Style {
  name: string;
}

interface WritingStyleAssistantProps {
  currentDescription: string;
  updateDescription: (text: string) => void;
  setPopupMessageWithTimeout: (message: string) => void;
  setShowWritingStyleModal: (show: boolean) => void;
}

const styles: Style[] = [
  { name: 'Descriptive' },
  { name: 'Analytical' },
  { name: 'Poetic' },
  { name: 'Innovative' },
  { name: 'Inclusive' },
  { name: 'Creative' },
  { name: 'Empathetic' },
  { name: 'Energetic' },
  { name: 'Narrative' },
  { name: 'Engaging' },
  { name: 'Inspirational' },
  { name: 'Optimistic' },
  { name: 'Visionary' },
  { name: 'Motivational' },
  { name: 'Persuasive' },
  { name: 'Witty' },
  { name: 'Insightful' },
];

const WritingStyleAssistant: React.FC<WritingStyleAssistantProps> = ({
  currentDescription,
  updateDescription,
  setPopupMessageWithTimeout,
  setShowWritingStyleModal,
}) => {
  const [loading, setLoading] = useState(false);

  // Function to call the API that enhances text based on the chosen style.
  const enhanceTextWithStyle = async (text: string, style: string): Promise<string> => {
    try {
      const response = await fetch(`https://u-mail.co/api/style-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, style }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.enhancedText ? data.enhancedText.trim() : "No enhanced text found.";
    } catch (error) {
      console.error("Error enhancing text:", error);
      setPopupMessageWithTimeout("Error enhancing text.");
      return "";
    }
  };

  // This function is triggered when a writing style is selected.
  // It shows the spinner immediately, performs the API call, and
  // guarantees that the spinner is visible for at least 2 seconds.
  const handleStyleChange = async (style: Style) => {
    // Close the modal.
    setShowWritingStyleModal(false);
    if (!currentDescription.trim()) {
      setPopupMessageWithTimeout("Add some text to enhance!");
      return;
    }
    // Log the event.
    trackEvent('Writing Style Selected', { style: style.name });
    // Show the spinner.
    setLoading(true);
    const startTime = Date.now();

    try {
      const enhancedText = await enhanceTextWithStyle(currentDescription, style.name);
      if (enhancedText) {
        updateDescription(enhancedText);
      }
    } catch (error) {
      console.error("Error applying writing style:", error);
    }

    // Calculate how long the operation took, and if less than 2 seconds,
    // wait the remaining time before hiding the spinner.
    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => {
      setLoading(false);
    }, delay);
  };

  return (
    <>
      {/* Modal for Writing Style Selection */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded p-6 w-full max-w-md">
          <div className="flex justify-end">
            <button
              type="button"
              className="text-gray-700 dark:text-gray-300 text-2xl"
              aria-label="Close"
              onClick={() => setShowWritingStyleModal(false)}
            >
              &times;
            </button>
          </div>
          <h5 className="text-xl font-semibold mb-4 text-center">Select Writing Style</h5>
          <div className="modal-body">
            <div className="list-group">
              {styles.map((style, index) => (
                <button
                  key={index}
                  type="button"
                  className="list-group-item list-group-item-action block w-full text-left p-2 bg-gray-200 dark:bg-gray-700 rounded mb-2 hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => handleStyleChange(style)}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-white" />
        </div>
      )}
    </>
  );
};

export default WritingStyleAssistant;
