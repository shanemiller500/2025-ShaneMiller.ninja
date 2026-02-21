"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faGlobe,
  faSmile,
  faPenNib,
  faPaperclip,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

import MoodToneAssistant from "./MoodToneAssistant";
import LanguageAssistant from "./LanguageAssistant";
import WritingStyleAssistant from "./WritingStyleAssistant";
import TextRefinementAssistant from "./TextRefinementAssistant";
import { Button } from "@/components/ui/button";

import UMail from "@/public/images/umailLogo.png";

interface ContactFormState {
  email: string;
  topic: string;
  subject: string;
  description: string;
  attachment: File | null;
}

interface Language {
  name: string;
  code: string;
  context?: string;
}

const INPUT_BASE_STYLES =
  "w-full rounded-xl bg-gray-50 text-gray-900 placeholder:text-gray-400 " +
  "dark:bg-brand-900/60 dark:text-gray-100 dark:placeholder:text-gray-500 " +
  "border border-gray-200 dark:border-white/10 " +
  "px-4 py-3 text-[15px] leading-6 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 " +
  "transition";

const MIN_LOADING_DELAY_MS = 2000;
const STYLE_LOADING_DELAY_MS = 3000;
const POPUP_DURATION_MS = 3500;

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormState>({
    email: "",
    topic: "",
    subject: "",
    description: "",
    attachment: null,
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showMoodToneModal, setShowMoodToneModal] = useState(false);
  const [showWritingStyleModal, setShowWritingStyleModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 18 + "px";
    }
  }, [formData.description]);

  useEffect(() => {
    trackEvent("Contact Page Viewed", { page: "Contact" });
  }, []);

  function showPopup(message: string, success = false) {
    setStatusMessage(message);
    setIsSuccess(success);
    setIsPopupVisible(true);
    setTimeout(() => setIsPopupVisible(false), POPUP_DURATION_MS);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFormData((prev) => ({ ...prev, attachment: files[0] }));
    }
  }

  function clearAttachment() {
    setFormData((prev) => ({ ...prev, attachment: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
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
      if (formData.attachment) {
        payload.append("attachment", formData.attachment);
      }

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while sending the message.", false);
    }
  }

  async function handleDefaultEnhance() {
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

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup("Message enhanced!", true);
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while enhancing the text.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(MIN_LOADING_DELAY_MS - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  }

  async function handleCustomEnhance(mood: string, tone: string) {
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

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      const enhancedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: enhancedText }));
      showPopup("Message enhanced with mood & tone!", true);
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while enhancing the text.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(MIN_LOADING_DELAY_MS - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  }

  async function enhanceTextWithStyle(text: string, style: string): Promise<string> {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("https://u-mail.co/api/style-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const enhancedText = data.enhancedText ? data.enhancedText.trim() : "No enhanced text found.";

      const elapsed = Date.now() - startTime;
      const delay = Math.max(STYLE_LOADING_DELAY_MS - elapsed, 0);
      setTimeout(() => setIsLoading(false), delay);

      return enhancedText;
    } catch (error) {
      console.error("Error enhancing text:", error);
      showPopup("Error enhancing text.", false);
      setIsLoading(false);
      return "";
    }
  }

  async function handleLanguageTranslation(language: Language) {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.text ? data.text.trim() : formData.description;
      setFormData((prev) => ({ ...prev, description: translatedText }));
      showPopup(`Message translated to ${language.name}!`, true);
    } catch (error) {
      console.error("Error translating text:", error);
      showPopup("An error occurred during translation.", false);
    }

    const elapsed = Date.now() - startTime;
    const delay = Math.max(MIN_LOADING_DELAY_MS - elapsed, 0);
    setTimeout(() => setIsLoading(false), delay);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData((prev) => ({ ...prev, attachment: e.dataTransfer.files[0] }));
    }
  }

  return (
    <section className="mt-6 md:mt-12 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PageHeader />

        <div className="mx-auto mt-8 max-w-[720px]">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-sm backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-indigo-500/10 to-transparent dark:from-indigo-400/10" />

            <form className="relative p-4 sm:p-6 md:p-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:gap-5">
                <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    className={`${INPUT_BASE_STYLES} placeholder:font-medium`}
                    placeholder="Name (optional)"
                    value={formData.subject}
                    onChange={handleChange}
                    autoComplete="name"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={`${INPUT_BASE_STYLES} placeholder:font-medium`}
                    placeholder="Email *"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                <input
                  id="topic"
                  name="topic"
                  type="text"
                  className={`${INPUT_BASE_STYLES} placeholder:font-medium`}
                  placeholder="Subject — feedback, feature request…"
                  value={formData.topic}
                  onChange={handleChange}
                />

                <AssistantToolbar
                  onMoodToneClick={() => {
                    trackEvent("MoodTone Modal Opened");
                    setShowMoodToneModal(true);
                  }}
                  onWritingStyleClick={() => {
                    trackEvent("WritingStyle Modal Opened");
                    setShowWritingStyleModal(true);
                  }}
                  onLanguageClick={() => {
                    trackEvent("Language Modal Opened");
                    setShowLanguageModal(true);
                  }}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  currentDescription={formData.description}
                  updateDescription={(newText) =>
                    setFormData((prev) => ({ ...prev, description: newText }))
                  }
                  showPopup={(msg) => showPopup(msg, false)}
                  textAreaSelectionRef={textAreaSelectionRef}
                />

                <MessageTextArea
                  value={formData.description}
                  onChange={handleChange}
                  textAreaRef={textAreaRef}
                  onSelect={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    textAreaSelectionRef.current = {
                      start: target.selectionStart,
                      end: target.selectionEnd,
                    };
                  }}
                />

                <AttachmentDropZone
                  attachment={formData.attachment}
                  isDragActive={isDragActive}
                  fileInputRef={fileInputRef}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onFileChange={handleFileChange}
                  onClear={clearAttachment}
                />

                <SubmitButton isLoading={isLoading} />
              </div>
            </form>
          </div>
        </div>

        <NotificationPopup
          isVisible={isPopupVisible}
          isSuccess={isSuccess}
          message={statusMessage}
          onClose={() => setIsPopupVisible(false)}
        />
      </div>

      <LoadingOverlay isVisible={isLoading} />

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
          onEnhance={handleCustomEnhance}
          onDefaultEnhance={handleDefaultEnhance}
          onClose={() => setShowMoodToneModal(false)}
        />
      )}

      {showWritingStyleModal && (
        <WritingStyleAssistant
          currentDescription={formData.description}
          updateDescription={(newDescription) =>
            setFormData((prev) => ({ ...prev, description: newDescription }))
          }
          setPopupMessageWithTimeout={(msg) => showPopup(msg, false)}
          setShowWritingStyleModal={setShowWritingStyleModal}
          enhanceTextWithStyle={enhanceTextWithStyle}
        />
      )}
    </section>
  );
}

function PageHeader() {
  return (
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
  );
}

interface AssistantToolbarProps {
  onMoodToneClick: () => void;
  onWritingStyleClick: () => void;
  onLanguageClick: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentDescription: string;
  updateDescription: (text: string) => void;
  showPopup: (message: string) => void;
  textAreaSelectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
}

function AssistantToolbar({
  onMoodToneClick,
  onWritingStyleClick,
  onLanguageClick,
  isLoading,
  setIsLoading,
  currentDescription,
  updateDescription,
  showPopup,
  textAreaSelectionRef,
}: AssistantToolbarProps) {
  return (
    <div className="pt-1">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 shadow-sm"
          onClick={onMoodToneClick}
          aria-label="Open Mood & Tone assistant"
        >
          <FontAwesomeIcon icon={faSmile} />
          <span className="truncate">Mood &amp; Tone</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 shadow-sm"
          onClick={onWritingStyleClick}
          aria-label="Open Writing Style assistant"
        >
          <FontAwesomeIcon icon={faPenNib} />
          <span className="truncate">Writing Style</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 shadow-sm"
          onClick={onLanguageClick}
          aria-label="Open Language assistant"
        >
          <FontAwesomeIcon icon={faGlobe} />
          <span className="truncate">Language</span>
        </Button>

        <div className="w-full sm:w-auto">
          <TextRefinementAssistant
            setPopupMessageWithTimeout={showPopup}
            globalLoading={isLoading}
            setGlobalLoading={setIsLoading}
            currentDescription={currentDescription}
            updateDescription={updateDescription}
            textAreaSelectionRef={textAreaSelectionRef}
          />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        Tip: highlight part of your message and hit{" "}
        <span className="font-semibold">Text Refine</span>.
      </p>
    </div>
  );
}

interface MessageTextAreaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
}

function MessageTextArea({ value, onChange, textAreaRef, onSelect }: MessageTextAreaProps) {
  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Message <span className="text-red-500">*</span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {value.trim().length}/2000
        </span>
      </div>

      <textarea
        id="description"
        name="description"
        rows={6}
        ref={textAreaRef}
        onSelect={onSelect}
        className={`${INPUT_BASE_STYLES} resize-none min-h-[160px] leading-7 placeholder:font-medium`}
        placeholder="What can I help with? *"
        value={value}
        onChange={onChange}
        required
        maxLength={2000}
      />
    </div>
  );
}

interface AttachmentDropZoneProps {
  attachment: File | null;
  isDragActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function AttachmentDropZone({
  attachment,
  isDragActive,
  fileInputRef,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFileChange,
  onClear,
}: AttachmentDropZoneProps) {
  return (
    <div>
      <div
        className={`group relative rounded-2xl border-2 border-dashed p-4 sm:p-5 transition cursor-pointer ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10"
            : "border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10"
        }`}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload attachment"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10">
            <FontAwesomeIcon icon={faPaperclip} className="text-gray-700 dark:text-gray-200" />
          </div>

          <div className="flex-1">
            {attachment ? (
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {attachment.name}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Click to replace, or remove.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Attachment (optional)
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Drag &amp; drop, or click to select.
                </p>
              </>
            )}
          </div>

          {attachment && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="inline-flex items-center gap-2 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              aria-label="Remove attachment"
            >
              <FontAwesomeIcon icon={faTrash} />
              <span className="hidden sm:inline">Remove</span>
            </Button>
          )}
        </div>

        <input
          type="file"
          id="attachment"
          name="attachment"
          className="hidden"
          ref={fileInputRef}
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="pt-2">
      <Button
        type="submit"
        variant="indigo"
        size="lg"
        fullWidth
        disabled={isLoading}
        className={isLoading ? "opacity-80 cursor-not-allowed" : ""}
      >
        {isLoading ? "Sending…" : "Send message"}
      </Button>

      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
        Your message data is never shared or used for AI/ML training purposes.
      </p>
    </div>
  );
}

interface NotificationPopupProps {
  isVisible: boolean;
  isSuccess: boolean;
  message: string;
  onClose: () => void;
}

function NotificationPopup({ isVisible, isSuccess, message, onClose }: NotificationPopupProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div
        className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg border text-white backdrop-blur ${
          isSuccess ? "bg-green-600/95 border-green-400/40" : "bg-red-600/95 border-red-400/40"
        }`}
      >
        <span className="text-sm leading-6">{message}</span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Close notification"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function LoadingOverlay({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-center text-white shadow-lg">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        <div className="mt-3 text-sm font-medium">Working on it…</div>
      </div>
    </div>
  );
}
