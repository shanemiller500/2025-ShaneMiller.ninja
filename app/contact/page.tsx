'use client';

import React, { useState, useEffect } from 'react';
import { trackEvent } from '@/utils/mixpanel';

interface ContactFormProps {
  onClose?: () => void;
}

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

  // Update text and textarea fields
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Update file attachment field
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({
        ...prev,
        attachment: e.target.files ? e.target.files[0] : null,
      }));
    }
  };

  // Form submit handler – sends the data to your API endpoint (which should use Nodemailer)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields: email and description
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = emailRegex.test(formData.email.trim());
    const hasDescription = formData.description.trim() !== '';

    if (!hasValidEmail || !hasDescription) {
      setStatusMessage(
        'Please fill in all required fields: Email and Description.'
      );
      setIsSuccess(false);
      setIsPopupVisible(true);
      return;
    }

    try {
      const payload = new FormData();

      // Dummy name and surname if needed by your API
      payload.append('name', 'Anonymous');
      payload.append('surname', 'Hidden');

      payload.append('email', formData.email);
      payload.append('topic', formData.topic.trim() || 'N/A');
      payload.append('subject', formData.subject.trim());
      payload.append('description', formData.description.trim());

      if (formData.attachment) {
        payload.append('attachment', formData.attachment);
      }

      // Replace this URL with your own endpoint that uses Nodemailer
      const response = await fetch('https://u-mail.co/api/send-email/contact', {
        method: 'POST',
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${errorText}`);
      }

      setStatusMessage('Message sent successfully!');
      setIsSuccess(true);
      setIsPopupVisible(true);

      // Reset the form
      setFormData({
        email: '',
        topic: '',
        subject: '',
        description: '',
        attachment: null,
      });
    } catch (error) {
      console.error(error);
      setStatusMessage('An error occurred while sending the message.');
      setIsSuccess(false);
      setIsPopupVisible(true);
    }
  };

  const handlePopupClose = () => {
    setIsPopupVisible(false);
    if (isSuccess) {
      // Handle success case
    }
  };

  // Utility to close parent dialog if needed
  function setIsOpen(value: boolean): void {
    if (!value) {
      // Handle close case
    }
  }

    useEffect(() => {
      trackEvent('Contact Page Viewed', { page: 'Contact' });
    }, []);

  return (
    <section className="text-gray-800 mt-40 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div>
          {/* Section header */}
          <div className="pb-5 text-center">
            <h1 className="pb-5 font-nacelle text-4xl font-semibold md:text-5xl">
             Say Hello
            </h1>
 
          </div>

 

          {/* The form */}
          <form className="mx-auto max-w-[640px]" onSubmit={handleSubmit}>

                                 {/* Name (optional) */}
                                 <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="subject">
                Name
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                className="form-input w-full bg-gray-100 text-gray-800 placeholder-gray-500
                           dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder="Your Name"
                value={formData.subject}
                onChange={handleChange}
              />
            </div>
            {/* EMAIL (required) */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input w-full bg-gray-100 text-gray-800 placeholder-gray-500
                           dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder="your.email@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>



            {/* DESCRIPTION (required) */}
            <div className="mt-4">
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="description"
              >
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                className="rounded w-full bg-gray-100 text-gray-800 placeholder-gray-500
                           dark:bg-brand-900 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder="On the topic..."
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            {/* SUBMIT + CLOSE */}
            <div className="mt-8 p-10 flex w-full flex-col justify-between gap-5 md:flex-row md:items-center">
              <div className="flex-1">
                <button
                  type="submit"
                  className="btn group w-full bg-gradient-to-t from-indigo-600 to-indigo-500
                             text-white shadow-[inset_0px_1px_0px_0px_theme(colors.white/.16)]
                             hover:bg-[length:100%_150%] dark:from-indigo-700 dark:to-indigo-600"
                >
                  <span className="relative inline-flex items-center">
                    Submit
                  
                  </span>
                </button>
              
                <p className="text-xs text-center mt-5 text-gray-500 dark:text-gray-400">
                  Your message is never shared
                </p>
              </div>
            
            </div>

            {/* POPUP NOTIFICATION */}
            {isPopupVisible && (
              <div className="fixed top-4 right-4 z-50 w-96">
                <div
                  className={`flex items-center justify-between px-4 py-3 rounded shadow-lg ${
                    isSuccess
                      ? 'bg-green-500 dark:bg-green-600'
                      : 'bg-red-500 dark:bg-red-600'
                  } text-white transition-transform duration-300 ease-in-out ${
                    isPopupVisible ? 'translate-y-0' : '-translate-y-4'
                  }`}
                >
                  <span>{statusMessage}</span>
                  <button
                    onClick={handlePopupClose}
                    className="text-white focus:outline-none"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
