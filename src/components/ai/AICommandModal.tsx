"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mic,
  MicOff,
  Send,
  RotateCcw,
  Loader2,
  MessageSquare,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCommandHistoryStore } from "@/stores/commandHistoryStore";
import { useSuggestionStore } from "@/stores/suggestionStore";
import type { ExecutedAction } from "@/stores/commandHistoryStore";
import type { DeviceStateSnapshot } from "@/lib/ai/command-processor";

interface AICommandModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Speech recognition types for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Command history item display
interface ConversationItem {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  canUndo?: boolean;
  actions?: ExecutedAction[];
  commandStoreId?: string; // Links to the command history store for undo
}

export function AICommandModal({ isOpen, onClose }: AICommandModalProps) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const { getAuthHeaders } = useAuthStore();
  const { addCommand, markUndone, getLastUndoableCommand, getSnapshotsForUndo } =
    useCommandHistoryStore();
  const { setContextualSuggestions, recordCommand, getTopSuggestions, clearContextualSuggestions } =
    useSuggestionStore();
  
  // Get current suggestions (reactive)
  const suggestions = getTopSuggestions(5);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      
      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setInput(finalTranscript);
          setInterimTranscript("");
          // Auto-submit after voice input
          setTimeout(() => {
            handleSubmit(finalTranscript);
          }, 300);
        } else {
          setInterimTranscript(interimTranscript);
        }
      };
      
      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Please enable it in your browser settings.");
        }
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom of conversation
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  // Toggle voice recording
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError(null);
      recognitionRef.current.start();
    }
  }, [isListening]);

  // Handle undo
  const handleUndo = useCallback(async (commandStoreId: string, conversationItemId: string) => {
    const snapshots = getSnapshotsForUndo(commandStoreId);
    if (snapshots.length === 0) {
      setError("No undo data available for this command.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: "undo",
          undoSnapshots: snapshots,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        markUndone(commandStoreId);
        setConversation((prev) => [
          ...prev,
          {
            id: `undo-${Date.now()}`,
            type: "assistant",
            content: data.response || "Undone successfully.",
            timestamp: new Date(),
          },
        ]);
        
        // Update the original message to show it was undone
        setConversation((prev) =>
          prev.map((item) =>
            item.id === conversationItemId ? { ...item, canUndo: false } : item
          )
        );
      } else {
        setError(data.error || "Failed to undo command.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo command.");
    } finally {
      setIsProcessing(false);
    }
  }, [getAuthHeaders, getSnapshotsForUndo, markUndone]);

  // Submit command
  const handleSubmit = useCallback(async (overrideInput?: string) => {
    const messageText = overrideInput || input.trim();
    if (!messageText || isProcessing) return;
    
    // Record command for frequent usage tracking
    recordCommand(messageText);
    
    // Add user message to conversation
    const userMessageId = `user-${Date.now()}`;
    const newUserMessage = {
      id: userMessageId,
      type: "user" as const,
      content: messageText,
      timestamp: new Date(),
    };
    
    setConversation((prev) => [...prev, newUserMessage]);
    
    setInput("");
    setIsProcessing(true);
    setError(null);
    
    try {
      // Build conversation history for context (last 10 messages)
      const historyForAPI = [...conversation, newUserMessage]
        .slice(-10)
        .map((msg) => ({
          role: msg.type === "user" ? "user" : "assistant",
          content: msg.content,
        }));
      
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ 
          message: messageText,
          conversationHistory: historyForAPI,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update contextual suggestions from AI if provided
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setContextualSuggestions(data.suggestions);
        }
        
        // Check if AI requested to clear conversation
        if (data.clearConversation) {
          setConversation([{
            id: `fresh-${Date.now()}`,
            type: "assistant",
            content: data.response,
            timestamp: new Date(),
          }]);
          // Clear contextual suggestions for fresh start
          clearContextualSuggestions();
        } else {
          const assistantMessageId = `assistant-${Date.now()}`;
          const hasActions = data.actions && data.actions.length > 0;
          
          // Add to command history store if there were actions and get the store ID
          let commandStoreId: string | undefined;
          if (hasActions) {
            commandStoreId = addCommand({
              userInput: messageText,
              aiResponse: data.response,
              actions: data.actions,
            });
          }
          
          setConversation((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              type: "assistant",
              content: data.response,
              timestamp: new Date(),
              canUndo: hasActions && !data.wasUndo,
              actions: data.actions,
              commandStoreId, // Link to command store for undo
            },
          ]);
        }
      } else {
        setError(data.error || "Failed to process command.");
        setConversation((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            type: "assistant",
            content: data.error || "Sorry, I couldn't process that command.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send command.";
      setError(errorMessage);
      setConversation((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: "assistant",
          content: "Sorry, there was an error processing your request.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, getAuthHeaders, addCommand, conversation, recordCommand, setContextualSuggestions, clearContextualSuggestions]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-32 left-4 right-4 md:left-auto md:right-6 md:w-[420px] bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border-light)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-gradient-to-r from-[var(--accent)]/10 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm">
                    AI Home Control
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Say or type a command
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            
            {/* Conversation Area */}
            <div
              ref={conversationRef}
              className="h-[280px] overflow-y-auto p-4 space-y-3"
            >
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-secondary)]">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No commands yet</p>
                  <p className="text-xs mt-1 max-w-[280px]">
                    Try saying "Turn off the lights on the 2nd floor" or "Set the living room to 72 degrees"
                  </p>
                </div>
              ) : (
                conversation.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${item.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                        item.type === "user"
                          ? "bg-[var(--accent)] text-white rounded-br-md"
                          : "bg-[var(--surface-hover)] text-[var(--text-primary)] rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm">{item.content}</p>
                      {item.type === "assistant" && item.canUndo && item.commandStoreId && (
                        <button
                          onClick={() => handleUndo(item.commandStoreId!, item.id)}
                          disabled={isProcessing}
                          className="mt-2 flex items-center gap-1 text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-[var(--surface-hover)] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                      <span className="text-sm text-[var(--text-secondary)]">
                        Processing...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Interim transcript */}
              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="bg-[var(--accent)]/50 text-white rounded-2xl rounded-br-md px-4 py-2 italic">
                    <p className="text-sm">{interimTranscript}...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Error display */}
            {error && (
              <div className="px-4 py-2 bg-[var(--danger)]/10 border-t border-[var(--danger)]/20">
                <div className="flex items-center gap-2 text-[var(--danger)] text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}
            
            {/* Input Area */}
            <div className="p-4 border-t border-[var(--border-light)] bg-[var(--background)]">
              <div className="flex items-center gap-2">
                {/* Voice button */}
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`p-3 rounded-xl transition-all ${
                      isListening
                        ? "bg-[var(--danger)] text-white animate-pulse"
                        : "bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                    } disabled:opacity-50`}
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>
                )}
                
                {/* Text input */}
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Listening..." : "Type a command..."}
                    disabled={isProcessing || isListening}
                    className="w-full px-4 py-4 bg-[var(--surface)] rounded-xl text-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50"
                  />
                </div>
                
                {/* Send button */}
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isProcessing}
                  className="p-3 rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              {/* Quick suggestions - dynamic based on context and usage */}
              <div className="flex flex-wrap gap-2 mt-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      handleSubmit(suggestion);
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-xs bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-full transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
