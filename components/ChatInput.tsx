"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Send, Mic, X, Loader2, Paperclip, Smile, Zap, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useChat } from "@/hooks/useChat";
import { useModels } from "@/hooks/useModels";
import { ModelPicker } from "./ModelPicker";
import { ModelSelectorChip } from "./ModelSelectorChip";
import { TypingIndicator } from "./TypingIndicator";
import { NexoCoder } from "./NexoCoder";
import { Signal } from "./Signal";

export function ChatInput({
  chatId,
  isLoading,
  onSendMessage,
  onNewChat,
  enabled = true,
  showModelPicker = true,
  className = "",
}: {
  chatId: string | null;
  isLoading: boolean;
  onSendMessage: (content: string, modelId?: string) => Promise<void>;
  onNewChat: () => void;
  enabled?: boolean;
  showModelPicker?: boolean;
  className?: string;
}) {
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showCoder, setShowCoder] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { selectedModel, setSelectedModel } = useModels();

  const handleHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    handleHeight();
  }, [input, handleHeight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedImages.length === 0) return;
    if (!enabled) return;

    const content = input.trim();
    const images = [...attachedImages];
    setInput("");
    setAttachedImages([]);
    handleHeight();

    await onSendMessage(content, selectedModel?.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    setAttachedImages((prev) => [...prev, ...validFiles].slice(0, 4));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        // TODO: Send audio for transcription
        console.log("Audio recorded:", audioBlob);
      };

      setMediaRecorder(recorder);
      setAudioChunks([]);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowPicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className={`${className} w-full`}>
      <div className="relative flex flex-col gap-2">
        {/* Model Selector Chip */}
        {showModelPicker && (
          <ModelSelectorChip
            selectedModel={selectedModel}
            onClick={() => setShowPicker(!showPicker)}
            className="self-start ml-1"
          />
        )}

        {/* Model Picker Dropdown */}
        {showModelPicker && showPicker && (
          <ModelPicker
            selectedModel={selectedModel}
            onSelect={handleModelSelect}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* Main Input Area */}
        <div className="relative flex items-end gap-2 bg-white/5 dark:bg-gray-900/50 backdrop-blur-sm border border-white/10 dark:border-gray-700/50 rounded-2xl p-2 transition-all duration-200">
          {/* Attached Images Preview */}
          {attachedImages.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 pr-1">
              {attachedImages.map((file, index) => (
                <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={`Attached image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "Nexio is thinking..." : "Message Nexio..."}
              disabled={isLoading || !enabled}
              className="w-full bg-transparent border-none outline-none resize-none text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 text-base leading-relaxed max-h-[200px] min-h-[24px] px-1 py-1.5"
              rows={1}
              aria-label="Message input"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Nexo Coder Toggle */}
            <button
              type="button"
              onClick={() => setShowCoder(!showCoder)}
              className={`p-2 rounded-xl transition-colors ${
                showCoder
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              aria-label="Toggle Nexo Coder"
              title="Nexo Coder"
            >
              <Zap className="w-5 h-5" />
            </button>

            {/* Attach Image */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Attach image"
              title="Attach image"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              aria-label="Image upload"
            />

            {/* Voice Recording */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-xl transition-colors ${
                isRecording
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start voice recording"}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!input.trim() && attachedImages.length === 0) || isLoading || !enabled}
              className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
                (input.trim() || attachedImages.length > 0) && !isLoading && enabled
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "text-gray-400 cursor-not-allowed"
              }`}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Nexo Coder Panel */}
        {showCoder && <NexoCoder onClose={() => setShowCoder(false)} />}

        {/* Typing Indicator */}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Signal Indicator */}
      <Signal chatId={chatId} />
    </form>
  );
}