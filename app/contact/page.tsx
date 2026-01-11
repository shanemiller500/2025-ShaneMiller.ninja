// app/contact/page.tsx
"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

import MoodToneAssistant from "./MoodToneAssistant";
import LanguageAssistant from "./LanguageAssistant";
import WritingStyleAssistant from "./WritingStyleAssistant";
import TextRefinementAssistant from "./TextRefinementAssistant";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faGlobe, faSmile, faPenNib, faPaperclip, faTrash } from "@fortawesome/free-solid-svg-icons";

import UMail from "@/public/images/umailLogo.png";

interface ContactFormState {
  email: string;
  topic: string;
  subject: string;
  description: string;
  attachment: File | null;
}

export default function ContactFormLogin() {
  const [formData, setFormData] = useState<ContactFormState>({
    email: "",
    topic: "",
    subject: "",
    description: "",
    attachment: null,
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showMoodToneModal, setShowMoodToneModal] = useState(false);
  const [showWritingStyleModal, setShowWritingStyleModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref to store the textarea selection range.
  const textAreaSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Auto-adjust the textarea height.
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 18 + "px";
    }
  }, [formData.description]);

  useEffect(() => {
    trackEvent("Contact Page Viewed", { page: "Contact" });
  }, []);

  const showPopup = (message: string, success: boolean = false) => {
    setStatusMessage(message);
    setIsSuccess(success);
    setIsPopupVisible(true);
    setTimeout(() => setIsPopupVisible(false), 3500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFormData((prev) => ({ ...prev, attachment: files[0] }));
    }
  };

  const clearAttachment = () => {
    setFormData((prev) => ({ ...prev, attachment: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim()) || formData.description.trim() === "") {
      showPopup("Please fill in all required fields: Email and Message.");
      setIsSuccess(false);
      return;
    }

    try {
      const payload = new FormData();
      payload.append("name", "Anonymous");
      payload.append("surname", "Hidden");
      payload.append("email", formData.email);
      payload.append("topic", formData.topic.trim() || "N/A");
      payload.append("subject", formData.subject.trim());
      payload.append("description", formData.description.trim());
      if (formData.attachment) payload.append("attachment", formData.attachment);

      const response = await fetch("https://u-mail.co/api/send-email/contact", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${errorText}`);
      }

      showPopup("Message sent successfully!", true);
      setFormData({ email: "", topic: "", subject: "", description: "", attachment: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while sending the message.", false);
    }
  };

  // --- Enhancement Functions (kept as-is, just moved cleanly) ---
  const displayEnhancedText = async () => {
    if (!formData.description.trim()) {
      showPopup("Add some text to enhance!");
      return;
    }

    trackEvent("Default Enhance Button Clicked");
    setShowMoodToneModal(false);
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("https://u-mail.co/api/text-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: formData.description }),
      });
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);

      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup("Message enhanced!", true);
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while enhancing the text.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  const displayCustomEnhancedText = async (mood: string, tone: string) => {
    if (!formData.description.trim()) {
      showPopup("Add some text to enhance!");
      return;
    }

    trackEvent("MoodTone Enhance Button Clicked", { mood, tone });
    setShowMoodToneModal(false);
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("https://u-mail.co/api/custom-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formData.description, mood, tone }),
      });
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);

      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup("Message enhanced with mood & tone!", true);
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while enhancing the text.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  const enhanceTextWithStyle = async (text: string, style: string): Promise<string> => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("https://u-mail.co/api/style-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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

  const handleLanguageTranslation = async (language: any) => {
    if (!formData.description.trim()) {
      showPopup("Add some text to translate!");
      return;
    }

    trackEvent("Language Translation Clicked", { language: language.name });
    setShowLanguageModal(false);
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("https://u-mail.co/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: formData.description,
          language: language.code,
          context: language.context || "",
        }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const translatedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: translatedText }));
      showPopup(`Message translated to ${language.name}!`, true);
    } catch (error) {
      console.error("Error translating text:", error);
      showPopup("An error occurred during translation.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(2000 - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  };

  // --- Drag & Drop Handlers ---
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

  // --- UI helpers ---
  const inputBase =
    "w-full rounded-xl bg-gray-50 text-gray-900 placeholder:text-gray-400 " +
    "dark:bg-brand-900/60 dark:text-gray-100 dark:placeholder:text-gray-500 " +
    "border border-gray-200 dark:border-white/10 " +
    "px-4 py-3 text-[15px] leading-6 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 " +
    "transition";

  const labelBase = "mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200";

  const toolBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border " +
    "border-gray-200 dark:border-white/10 " +
    "bg-white/70 dark:bg-white/5 " +
    "px-3 py-2 text-sm font-medium " +
    "text-gray-800 dark:text-gray-100 " +
    "hover:bg-gray-50 dark:hover:bg-white/10 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 " +
    "transition";

  return (
    <section className="mt-6 md:mt-12 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            <span className="opacity-80">Powered by</span>
            <span className="inline-flex items-center gap-1">
              <Image src={UMail} alt="UMail Logo" width={18} height={18} />
              <span className="text-gray-800 dark:text-gray-100">Mail</span>
            </span>
          </div>

          <h1 className="mt-5 font-nacelle text-3xl md:text-5xl font-semibold tracking-tight">
            Say Hello
          </h1>
          <p className="mt-3 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Send a message, attach a file, and use the assistants to polish it before you hit send.
          </p>
        </div>

        {/* Card */}
        <div className="mx-auto mt-8 max-w-[720px]">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-sm backdrop-blur">
            <form className="p-4 sm:p-6 md:p-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:gap-5">
                {/* Name */}
                <div>
                  <label className={labelBase} htmlFor="subject">
                    Name
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    className={inputBase}
                    placeholder="Your name"
                    value={formData.subject}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className={labelBase} htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={inputBase}
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {/* Topic (kept, but optional) */}
                <div>
                  <label className={labelBase} htmlFor="topic">
                    Topic <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="topic"
                    name="topic"
                    type="text"
                    className={inputBase}
                    placeholder="Billing, feedback, feature request…"
                    value={formData.topic}
                    onChange={handleChange}
                  />
                </div>

             {/* Toolbar */}
<div className="pt-1">
  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
    <button
      type="button"
      onClick={() => {
        trackEvent("MoodTone Modal Opened");
        setShowMoodToneModal(true);
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 sm:w-auto sm:px-3.5 sm:py-2 sm:text-sm"
    >
      <FontAwesomeIcon icon={faSmile} />
      <span className="truncate">Mood &amp; Tone</span>
    </button>

    <button
      type="button"
      onClick={() => {
        trackEvent("WritingStyle Modal Opened");
        setShowWritingStyleModal(true);
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 sm:w-auto sm:px-3.5 sm:py-2 sm:text-sm"
    >
      <FontAwesomeIcon icon={faPenNib} />
      <span className="truncate">Writing Style</span>
    </button>

    <button
      type="button"
      onClick={() => {
        trackEvent("Language Modal Opened");
        setShowLanguageModal(true);
      }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 sm:w-auto sm:px-3.5 sm:py-2 sm:text-sm"
    >
      <FontAwesomeIcon icon={faGlobe} />
      <span className="truncate">Language</span>
    </button>

    {/* Text Refinement Assistant */}
    <div className="w-full sm:w-auto">
      <TextRefinementAssistant
        setPopupMessageWithTimeout={(msg: string) => showPopup(msg, false)}
        globalLoading={isLoading}
        setGlobalLoading={setIsLoading}
        currentDescription={formData.description}
        updateDescription={(newText: string) =>
          setFormData((prev) => ({ ...prev, description: newText }))
        }
        textAreaSelectionRef={textAreaSelectionRef}
      />
    </div>
  </div>

  <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
    Tip: highlight part of your message and hit{" "}
    <span className="font-semibold">Text Refine</span>.
  </p>
</div>


                {/* Message */}
                <div>
                  <label className={labelBase} htmlFor="description">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={6}
                    ref={textAreaRef}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      textAreaSelectionRef.current = {
                        start: target.selectionStart,
                        end: target.selectionEnd,
                      };
                    }}
                    className={
                      inputBase +
                      " resize-none min-h-[140px] " +
                      "leading-7"
                    }
                    placeholder="What can I help with?"
                    value={formData.description}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Attachment */}
                <div>
                  <label className={labelBase} htmlFor="attachment">
                    Attachment <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                  </label>

                  <div
                    className={
                      "group relative rounded-2xl border-2 border-dashed p-4 sm:p-5 " +
                      "transition cursor-pointer " +
                      (dragActive
                        ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10"
                        : "border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10")
                    }
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    aria-label="Upload attachment"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10">
                        <FontAwesomeIcon icon={faPaperclip} className="text-gray-700 dark:text-gray-200" />
                      </div>

                      <div className="flex-1">
                        {formData.attachment ? (
                          <>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {formData.attachment.name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Click to replace, or remove below.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Drag &amp; drop a file here
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Or click to select from your device.
                            </p>
                          </>
                        )}
                      </div>

                      {formData.attachment && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearAttachment();
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/10 transition"
                          aria-label="Remove attachment"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      )}
                    </div>

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

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className={
                      "w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm " +
                      "bg-gradient-to-r from-indigo-600 to-purple-600 " +
                      "hover:from-indigo-700 hover:to-purple-700 " +
                      "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 " +
                      "transition"
                    }
                  >
                    Send message
                  </button>

                  <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                    Your message data is never shared or used for AI/ML training purposes.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Popup Notification */}
        {isPopupVisible && (
          <div className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm">
            <div
              className={
                "flex items-start justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg border " +
                (isSuccess
                  ? "bg-green-600/95 border-green-400/40"
                  : "bg-red-600/95 border-red-400/40") +
                " text-white backdrop-blur"
              }
            >
              <span className="text-sm leading-6">{statusMessage}</span>
              <button
                onClick={() => setIsPopupVisible(false)}
                className="rounded-lg p-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Close notification"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Spinner Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-center text-white shadow-lg">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <div className="mt-3 text-sm font-medium">Working on it…</div>
          </div>
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
          updateDescription={(newDescription: string) => setFormData((prev) => ({ ...prev, description: newDescription }))}
          setPopupMessageWithTimeout={(msg: string) => showPopup(msg, false)}
          setShowWritingStyleModal={setShowWritingStyleModal}
          enhanceTextWithStyle={enhanceTextWithStyle}
        />
      )}
    </section>
  );
}
