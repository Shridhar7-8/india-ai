"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import MessageBubble from "./MessageBubble";

interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    isStreaming?: boolean;
}

interface ChatInterfaceProps {
    conversationId: number | null;
    messages: Message[];
    isLoading: boolean;
    isInterviewComplete: boolean;
    currentStepId: string | null;
    stepIndex: number;
    totalSteps: number;
    onSendMessage: (content: string) => void;
}

export default function ChatInterface({
    conversationId,
    messages,
    isLoading,
    isInterviewComplete,
    currentStepId,
    stepIndex,
    totalSteps,
    onSendMessage,
}: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showUpload = currentStepId === "pitch_deck" && !uploadedFile;

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "inherit";
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;
        }
    }, [input]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset upload state when step changes away from pitch_deck
    useEffect(() => {
        if (currentStepId !== "pitch_deck") {
            setUploadedFile(null);
        }
    }, [currentStepId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isInterviewComplete) return;
        onSendMessage(input.trim());
        setInput("");
    };

    const handleFileUpload = async (file: File) => {
        if (!conversationId) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("conversationId", String(conversationId));

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setUploadedFile(data.fileName);
                // Auto-send a message saying the file was uploaded
                onSendMessage(`I have uploaded my pitch deck: ${data.fileName}`);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || "Upload failed. Please try again.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed. Please check your connection.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
        // Reset so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
    };

    // Compute progress
    const progressPercent = totalSteps > 0 ? Math.min(Math.round((stepIndex / totalSteps) * 100), 100) : 0;
    const getPhaseLabel = () => {
        if (stepIndex <= 10) return "Founder";
        if (stepIndex <= 16) return "Business";
        if (stepIndex <= 21) return "AI & Mission";
        return "Closing";
    };

    return (
        <div className="flex flex-col h-full">
            {/* Progress bar — only show during active interview */}
            {messages.length > 0 && !isInterviewComplete && (
                <div className="flex-none px-4 md:px-6 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-500">
                            {getPhaseLabel()}
                        </span>
                        <span className="text-xs text-gray-400">
                            {progressPercent}%
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${Math.max(progressPercent, 2)}%`,
                                background: 'linear-gradient(90deg, #E8793A, #f59e0b)',
                            }}
                        />
                    </div>
                </div>
            )}
            {/* Completed progress bar */}
            {isInterviewComplete && messages.length > 0 && (
                <div className="flex-none px-4 md:px-6 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-green-600">
                            ✅ Interview Complete
                        </span>
                        <span className="text-xs text-green-500">
                            100%
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out bg-green-500"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 md:space-y-8">
                        {/* Logo */}
                        <div className="relative">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white p-3 shadow-lg ring-1 ring-gray-100 flex items-center justify-center">
                                <Image
                                    src="/logo.png"
                                    alt="ITEL Foundation"
                                    width={64}
                                    height={64}
                                    className="object-contain"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-w-lg space-y-4 md:space-y-6 px-4">
                            <h1 className="text-3xl md:text-5xl tracking-tight text-gray-800 font-medium">
                                <span className="font-light">Welcome to </span>
                                <span className="text-gray-900">FounderCheck</span>
                            </h1>

                            <p className="text-gray-500 text-base md:text-lg font-light">
                                Say hello to start the conversation.
                            </p>

                            {/* Question prompt */}
                            {/* <div className="mt-8">
                                <button
                                    onClick={onNewConversation}
                                    className="btn-primary px-8 py-3 text-base md:text-lg"
                                >
                                    Start New Interview
                                </button>
                            </div> */}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                role={message.role}
                                content={message.content}
                                timestamp={message.created_at}
                                isStreaming={message.isStreaming}
                            />
                        ))}
                        {isLoading && (
                            <div className="flex justify-start mb-4">
                                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3">
                                    <div className="flex space-x-2">
                                        <div
                                            className="w-2 h-2 rounded-full animate-bounce"
                                            style={{ backgroundColor: '#E8793A', animationDelay: "0ms" }}
                                        ></div>
                                        <div
                                            className="w-2 h-2 rounded-full animate-bounce"
                                            style={{ backgroundColor: '#E8793A', animationDelay: "150ms" }}
                                        ></div>
                                        <div
                                            className="w-2 h-2 rounded-full animate-bounce"
                                            style={{ backgroundColor: '#E8793A', animationDelay: "300ms" }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {isInterviewComplete && !isLoading && (
                            <div className="flex justify-center my-6">
                                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-4 max-w-md text-center">
                                    <p className="font-medium mb-2" style={{ color: '#E8793A' }}>
                                        ✅ Session Completed
                                    </p>
                                    <p className="text-gray-600 text-sm mb-2">
                                        Your analysis has been completed and a comprehensive report
                                        has been generated.
                                    </p>
                                    <p className="text-gray-400 text-xs font-light">
                                        Chat is now disabled. Thank you for using FounderCheck.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input area */}
            <div className="border-t border-white/20 p-3 pb-6 md:p-4 bg-white/40 backdrop-blur-md z-10">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
                    {isInterviewComplete ? (
                        <div className="text-center py-3 text-gray-500 text-sm md:text-base">
                            Session completed. Report has been generated and sent for review.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* File upload area — only when pitch_deck step is active */}
                            {showUpload && (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-orange-200 bg-orange-50/10 rounded-xl p-4 text-center cursor-pointer
                                               hover:border-orange-400 hover:bg-orange-50/20 transition-all font-light"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    {isUploading ? (
                                        <div className="flex items-center justify-center gap-2 text-green-600">
                                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            <span className="text-sm font-medium">Uploading...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center gap-2 mb-1" style={{ color: '#E8793A' }}>
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <span className="text-sm font-medium">Upload Pitch Deck</span>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Drop a file here or click to browse • PDF, DOC, DOCX, PPT, PPTX (max 10MB)
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Text input + send button */}
                            <div className="flex gap-2 md:gap-3 items-end">
                                <div className="flex-1 relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmit(e);
                                            }
                                        }}
                                        placeholder={
                                            !conversationId
                                                ? "Start a new conversation..."
                                                : showUpload
                                                    ? "Or type 'no' if you don't have a pitch deck..."
                                                    : "Type your message..."
                                        }
                                        disabled={isInterviewComplete || isUploading}
                                        rows={1}
                                        className="w-full bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-3 text-sm md:text-base text-gray-800 placeholder-gray-400 
                             focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed resize-none custom-scrollbar block"
                                        style={{ minHeight: "46px", maxHeight: "150px" }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={
                                        isLoading || !input.trim() || isInterviewComplete || isUploading
                                    }
                                    className="btn-primary text-sm md:text-base px-4 md:px-6 h-[46px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {isLoading ? "..." : "Send"}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
