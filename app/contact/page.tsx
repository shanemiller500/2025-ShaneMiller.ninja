'use client';

import React, { useState, useEffect, useRef } from 'react';
import { trackEvent } from '@/utils/mixpanel';
import MoodToneAssistant from './MoodToneAssistant';
import LanguageAssistant from './LanguageAssistant';
import WritingStyleAssistant from './WritingStyleAssistant';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faGlobe, faSmile, faPenNib } from '@fortawesome/free-solid-svg-icons';

interface ContactFormState {
  email: string;
  topic: string;
  subject: string;
  description: string;
  attachment: File | null;
}

export default function ContactFormLogin() {
  const [formData, setFormData] = useState<ContactFormState>({
    email: '',
    topic: '',
    subject: '',
    description: '',
    attachment: null,
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showMoodToneModal, setShowMoodToneModal] = useState(false);
  const [showWritingStyleModal, setShowWritingStyleModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-adjust the textarea height.
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 20 + 'px';
    }
  }, [formData.description]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // This handler is used both for the file input and for drag-and-drop.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFormData((prev) => ({ ...prev, attachment: files[0] }));
    }
  };

  const showPopup = (message: string, success: boolean = false) => {
    setStatusMessage(message);
    setIsSuccess(success);
    setIsPopupVisible(true);
    setTimeout(() => {
      setIsPopupVisible(false);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim()) || formData.description.trim() === '') {
      showPopup('Please fill in all required fields: Email and Message.');
      setIsSuccess(false);
      return;
    }
    try {
      const payload = new FormData();
      payload.append('name', 'Anonymous');
      payload.append('surname', 'Hidden');
      payload.append('email', formData.email);
      payload.append('topic', formData.topic.trim() || 'N/A');
      payload.append('subject', formData.subject.trim());
      payload.append('description', formData.description.trim());
      if (formData.attachment) {
        payload.append('attachment', formData.attachment);
      }
      const response = await fetch('https://u-mail.co/api/send-email/contact', {
        method: 'POST',
        body: payload,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${errorText}`);
      }
      showPopup('Message sent successfully!', true);
      setFormData({ email: '', topic: '', subject: '', description: '', attachment: null });
    } catch (error) {
      console.error(error);
      showPopup('An error occurred while sending the message.', false);
    }
  };

  // --- Enhancement Functions ---

  // Default enhancement (without mood & tone)
  const displayEnhancedText = async () => {
    if (!formData.description.trim()) {
      showPopup('Add some text to enhance!');
      return;
    }
    trackEvent('Default Enhance Button Clicked');
    setShowMoodToneModal(false);
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const response = await fetch('https://u-mail.co/api/text-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: formData.description }),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup('Message enhanced!', true);
    } catch (error) {
      console.error(error);
      showPopup('An error occurred while enhancing the text.', false);
    }
    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  // Enhancement with mood & tone.
  const displayCustomEnhancedText = async (mood: string, tone: string) => {
    if (!formData.description.trim()) {
      showPopup('Add some text to enhance!');
      return;
    }
    trackEvent('MoodTone Enhance Button Clicked', { mood, tone });
    setShowMoodToneModal(false);
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const response = await fetch('https://u-mail.co/api/custom-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData.description, mood, tone }),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup('Message enhanced with mood & tone!', true);
    } catch (error) {
      console.error(error);
      showPopup('An error occurred while enhancing the text.', false);
    }
    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  // --- Writing Style Enhancement Function ---
  // This function now guarantees that the spinner remains visible for at least 3 seconds.
  const enhanceTextWithStyle = async (text: string, style: string): Promise<string> => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const response = await fetch('https://u-mail.co/api/style-enhance', {
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
      const enhancedText = data.enhancedText ? data.enhancedText.trim() : "No enhanced text found.";
      const elapsed = Date.now() - startTime;
      const delay = Math.max(3000 - elapsed, 0);
      setTimeout(() => setIsLoading(false), delay);
      return enhancedText;
    } catch (error) {
      console.error("Error enhancing text:", error);
      showPopup("Error enhancing text.", false);
      setIsLoading(false);
      return "";
    }
  };

  // Translate text to selected language.
  const handleLanguageTranslation = async (language: any) => {
    if (!formData.description.trim()) {
      showPopup('Add some text to translate!');
      return;
    }
    trackEvent('Language Translation Clicked', { language: language.name });
    setShowLanguageModal(false);
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const response = await fetch('https://u-mail.co/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData.description, language: language.code, context: language.context || '' }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const translatedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: translatedText }));
      showPopup(`Message translated to ${language.name}!`, true);
    } catch (error) {
      console.error('Error translating text:', error);
      showPopup('An error occurred during translation.', false);
    }
    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  useEffect(() => {
    trackEvent('Contact Page Viewed', { page: 'Contact' });
  }, []);

  // --- Drag & Drop Handlers for Attachment ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData((prev) => ({ ...prev, attachment: e.dataTransfer.files[0] }));
    }
  };

  return (
    <section className="text-gray-800 mt-10 md:mt-40 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div>
          {/* Section header */}
          <div className="pb-5 text-center">
            <h1 className="pb-5 font-nacelle text-3xl md:text-4xl lg:text-5xl font-semibold">Say Hello</h1>
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              This contact page is powered by UMail
            </div>
          </div>
          {/* The form */}
          <form className="mx-auto max-w-[640px]" onSubmit={handleSubmit}>
            {/* Name */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="subject">
                Name
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                className="form-input w-full bg-gray-100 text-gray-800 placeholder-gray-500 dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400 p-2 rounded"
                placeholder="Your Name"
                value={formData.subject}
                onChange={handleChange}
              />
            </div>
            {/* Email */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input w-full bg-gray-100 text-gray-800 placeholder-gray-500 dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400 p-2 rounded"
                placeholder="your.email@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            {/* Toolbar for assistants */}
            <div className="mt-4 flex flex-row space-x-4 justify-center">

              <button
                type="button"
                onClick={() => {
                  trackEvent('MoodTone Modal Opened');
                  setShowMoodToneModal(true);
                }}
                className="btn btn-outline-primary btn-sm get-in-touch px-4 py-2 rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition"
              >
                <FontAwesomeIcon icon={faSmile} className="mr-2" />
                <span className="hidden sm:inline">Mood &amp; Tone</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent('WritingStyle Modal Opened');
                  setShowWritingStyleModal(true);
                }}
                className="btn btn-outline-primary btn-sm get-in-touch px-4 py-2 rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition"
              >
                <FontAwesomeIcon icon={faPenNib} className="mr-2" />
                <span className="hidden sm:inline">Writing Style</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  trackEvent('Language Modal Opened');
                  setShowLanguageModal(true);
                }}
                className="btn btn-outline-primary btn-sm get-in-touch px-4 py-2 rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition"
              >
                <FontAwesomeIcon icon={faGlobe} className="mr-2" />
                <span className="hidden sm:inline">Change Language</span>
              </button>
            </div>
            {/* Description/Message */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="description">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                ref={textAreaRef}
                className="rounded w-full bg-gray-100 text-gray-800 placeholder-gray-500 dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400 p-2 resize-none"
                placeholder="Your message..."
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>
            {/* Drag & Drop File Attachment */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="attachment">
                Attachment
              </label>
              <div
                className={`border-2 border-dashed rounded p-4 text-center cursor-pointer ${
                  dragActive ? 'border-indigo-600 bg-gray-100' : 'border-gray-300'
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {formData.attachment ? (
                  <p>{formData.attachment.name}</p>
                ) : (
                  <p>Drag &amp; drop your file here, or click to select a file</p>
                )}
                <input
                  type="file"
                  id="attachment"
                  name="attachment"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>
            {/* Submit Button */}
            <div className="mt-8 p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex-1">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-500 text-white p-3 rounded shadow hover:from-indigo-700 hover:to-indigo-600 transition"
                >
                  <span className="relative inline-flex items-center">Send</span>
                </button>
                <p className="text-xs text-center mt-5 text-gray-500 dark:text-gray-400">
                  Your message data is never shared or used for AI/ML training purposes.
                </p>
              </div>
            </div>
          </form>
          {/* Popup Notification */}
          {isPopupVisible && (
            <div className="fixed top-4 right-4 z-50 w-80 md:w-96">
              <div
                className={`flex items-center justify-between px-4 py-3 rounded shadow-lg ${
                  isSuccess ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500 dark:bg-red-600'
                } text-white transition-transform duration-300 ease-in-out`}
              >
                <span>{statusMessage}</span>
                <button onClick={() => setIsPopupVisible(false)} className="text-white focus:outline-none">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Spinner Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-white" />
        </div>
      )}
      {/* Assistant Modals */}
      {showLanguageModal && (
        <LanguageAssistant
          currentText={formData.description}
          onTranslate={handleLanguageTranslation}
          onClose={() => setShowLanguageModal(false)}
        />
      )}
      {showMoodToneModal && (
        <MoodToneAssistant
          currentText={formData.description}
          onEnhance={displayCustomEnhancedText}
          onDefaultEnhance={displayEnhancedText}
          onClose={() => setShowMoodToneModal(false)}
        />
      )}
      {showWritingStyleModal && (
        <WritingStyleAssistant
          currentDescription={formData.description}
          updateDescription={(newDescription: string) =>
            setFormData((prev) => ({ ...prev, description: newDescription }))
          }
          setPopupMessageWithTimeout={(msg: string) => showPopup(msg, false)}
          setShowWritingStyleModal={setShowWritingStyleModal}
          enhanceTextWithStyle={enhanceTextWithStyle} // Pass the new prop here.
        />
      )}
    </section>
  );
}
