"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import {
  CheckCircle2,
  Languages,
  LoaderCircle,
  Paperclip,
  PenTool,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import MoodToneAssistant from "./MoodToneAssistant";
import LanguageAssistant from "./LanguageAssistant";
import WritingStyleAssistant from "./WritingStyleAssistant";
import TextRefinementAssistant from "./TextRefinementAssistant";
import { Button } from "@/components/ui/button";

import UMail from "@/public/images/umailLogo.png";
import "./contact.css";
import { trackButtonSpotlight } from "./contact-effects";

interface ContactFormState {
  name: string;
  email: string;
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
  "contact-field w-full px-5 py-4 text-[16px] " +
  "leading-6 text-slate-900 outline-none placeholder:text-slate-400 " +
  "dark:text-white dark:placeholder:text-slate-500";

const MIN_LOADING_DELAY_MS = 2000;
const STYLE_LOADING_DELAY_MS = 3000;
const POPUP_DURATION_MS = 3500;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormState>({
    name: "",
    email: "",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  function selectAttachment(file: File) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      showPopup("Please choose a file smaller than 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFormData((prev) => ({ ...prev, attachment: file }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectAttachment(file);
  }

  function clearAttachment() {
    setFormData((prev) => ({ ...prev, attachment: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmitting) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim()) || formData.description.trim() === "") {
      showPopup("Please fill in all required fields: Email and Message.");
      setIsSuccess(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("name", formData.name.trim() || "Anonymous");
      payload.append("surname", "Hidden");
      payload.append("email", formData.email.trim());
      payload.append("topic", "Portfolio contact");
      payload.append("subject", formData.subject.trim() || "Portfolio message");
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
      setFormData({ name: "", email: "", subject: "", description: "", attachment: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      showPopup("An error occurred while sending the message.", false);
    } finally {
      setIsSubmitting(false);
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
      selectAttachment(e.dataTransfer.files[0]);
    }
  }

  return (
    <section onPointerMove={trackButtonSpotlight} className="contact-experience relative isolate w-full min-w-0 flex-1 overflow-hidden pb-16 pt-10 text-slate-900 sm:pb-24 sm:pt-16 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="contact-atmosphere absolute inset-0" />
        <div className="contact-grid absolute inset-0" />
        <div className="contact-orbit contact-orbit-one" />
        <div className="contact-orbit contact-orbit-two" />
      </div>

      <div className="mx-auto w-full min-w-0 max-w-[880px] px-1 sm:px-5">
        <ContactIntro />

        <div className="relative mt-10 min-w-0 max-w-full sm:mt-14">
          <div className="contact-surface relative">
            <div className="contact-signal" aria-hidden="true" />
            <form className="min-w-0 px-5 py-8 sm:p-10 lg:p-12" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-8 sm:gap-10">
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-8">
                    <label htmlFor="name" className="block">
                      <span className="mb-3 block text-sm font-medium text-slate-600 dark:text-slate-300">
                        Name <span className="normal-case tracking-normal text-slate-400">· optional</span>
                      </span>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        className={INPUT_BASE_STYLES}
                        placeholder="Your name"
                        value={formData.name}
                        onChange={handleChange}
                        autoComplete="name"
                      />
                    </label>

                    <label htmlFor="email" className="block">
                      <span className="mb-3 block text-sm font-medium text-slate-600 dark:text-slate-300">
                        Email <span className="text-indigo-600 dark:text-indigo-400">*</span>
                      </span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className={INPUT_BASE_STYLES}
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                    </label>
                  </div>

                  <label htmlFor="subject" className="block">
                    <span className="mb-3 block text-sm font-medium text-slate-600 dark:text-slate-300">
                      Subject <span className="normal-case tracking-normal text-slate-400">· optional</span>
                    </span>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      className={INPUT_BASE_STYLES}
                      placeholder="Feedback, an idea, or a project"
                      value={formData.subject}
                      onChange={handleChange}
                    />
                  </label>

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

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                      Writing help
                      <span className="ml-auto text-xs font-normal text-slate-400 dark:text-slate-500">Optional</span>
                    </div>
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
                  </div>

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

                  <SubmitButton isSubmitting={isSubmitting} />
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

function ContactIntro() {
  return (
    <div className="mx-auto min-w-0 max-w-xl text-center">
      <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs">
        <span className="text-indigo-500 dark:text-indigo-300">~/contact</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Inbox open
        </span>
      </div>

      <h1 className="mt-7 font-aspekta text-4xl font-[650] leading-[1.15] tracking-tight text-slate-950 sm:text-5xl dark:text-white">
        Say <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-400 bg-clip-text text-transparent">hello.</span>
      </h1>
      <p className="mt-5 text-base leading-7 text-slate-500 dark:text-slate-400">Send a message. I’ll take it from there.</p>
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
    <div>
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-4">
        <Button
          type="button"
          variant="secondary"
          size={null}
          className="contact-tool inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-slate-200/80 bg-white/60 px-3 py-3 text-xs font-medium shadow-none transition-colors duration-300 motion-reduce:transition-none hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/10 dark:bg-white/[0.025] dark:hover:bg-white/[0.06]"
          onClick={onMoodToneClick}
          aria-label="Open Mood & Tone assistant"
        >
          <Smile className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
          <span>Mood &amp; Tone</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size={null}
          className="contact-tool inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-slate-200/80 bg-white/60 px-3 py-3 text-xs font-medium shadow-none transition-colors duration-300 motion-reduce:transition-none hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/10 dark:bg-white/[0.025] dark:hover:bg-white/[0.06]"
          onClick={onWritingStyleClick}
          aria-label="Open Writing Style assistant"
        >
          <PenTool className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
          <span>Writing Style</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size={null}
          className="contact-tool inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-slate-200/80 bg-white/60 px-3 py-3 text-xs font-medium shadow-none transition-colors duration-300 motion-reduce:transition-none hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/10 dark:bg-white/[0.025] dark:hover:bg-white/[0.06]"
          onClick={onLanguageClick}
          aria-label="Open Language assistant"
        >
          <Languages className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
          <span>Language</span>
        </Button>

        <div className="w-full">
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
    <label htmlFor="description" className="relative block">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Message <span className="text-indigo-600 dark:text-indigo-400">*</span>
        </span>
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
          {value.length}/2000
        </span>
      </div>

      <textarea
        id="description"
        name="description"
        rows={7}
        ref={textAreaRef}
        onSelect={onSelect}
        className={`${INPUT_BASE_STYLES} min-h-[220px] resize-none leading-8 sm:min-h-[260px]`}
        placeholder="What would you like to discuss?"
        value={value}
        onChange={onChange}
        required
        maxLength={2000}
      />
    </label>
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
    <div
      className={`contact-attachment rounded-2xl border border-dashed p-4 transition-colors duration-300 motion-reduce:transition-none sm:p-5 ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10 dark:bg-indigo-500/10"
            : "border-slate-200 bg-slate-50/40 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-indigo-400/30 dark:hover:bg-indigo-400/[0.05]"
        }`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <Paperclip className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {attachment ? attachment.name : "Attachment"}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {attachment ? formatFileSize(attachment.size) : "Up to 10 MB"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {attachment && (
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={onClear}
              aria-label="Remove attachment"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-indigo-400/30 dark:hover:text-indigo-200"
            onClick={() => fileInputRef.current?.click()}
          >
            {attachment ? "Replace" : "Browse"}
          </button>
        </div>
      </div>

      <input
        type="file"
        id="attachment"
        name="attachment"
        className="sr-only"
        ref={fileInputRef}
        onChange={onFileChange}
        tabIndex={-1}
      />
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <div className="border-t border-slate-200/60 pt-8 dark:border-white/10 sm:pt-10">
      <Button
        type="submit"
        variant="indigo"
        size="lg"
        fullWidth
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="contact-send group inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-500 text-white shadow-[0_6px_20px_-10px_rgba(99,102,241,0.35)] transition-colors duration-300 motion-reduce:transition-none hover:bg-indigo-600 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Send message
            <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        Private · Never used for AI training
      </p>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <Image src={UMail} alt="" width={13} height={13} />
        Sent via U-Mail
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
    <div className="fixed right-4 top-4 z-[80] w-[calc(100vw-2rem)] max-w-sm" role="alert" aria-live="assertive">
      <div
        className={`flex items-center gap-3 rounded-2xl border bg-white/95 p-3 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:bg-[#1a1a1d]/95 ${
          isSuccess ? "border-emerald-200 dark:border-emerald-400/20" : "border-red-200 dark:border-red-400/20"
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            isSuccess
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
              : "bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-300"
          }`}
        >
          {isSuccess ? <CheckCircle2 className="h-4.5 w-4.5" /> : <X className="h-4.5 w-4.5" />}
        </span>
        <span className="flex-1 text-sm font-medium leading-5 text-slate-800 dark:text-slate-100">
          {message}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LoadingOverlay({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/80 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
          <LoaderCircle className="h-4 w-4 animate-spin" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider">AI is working…</span>
      </div>
    </div>
  );
}
