"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    isStreaming?: boolean;
}

export default function MessageBubble({
    role,
    content,
    timestamp,
    isStreaming,
}: MessageBubbleProps) {
    const isUser = role === "user";

    const hasApproved =
        content.includes("✅ APPROVED") ||
        content.includes("✅ INITIAL CHECKS PASSED") ||
        content.includes("✅ LOGIC LOCKED");
    const hasBlocked =
        content.includes("🛑 BLOCK") || content.includes("🛑 PAUSE");

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 message-enter`}
        >
            <div
                className={`max-w-[90%] md:max-w-[80%] ${isUser ? "order-2" : "order-1"}`}
            >
                <div
                    className={`rounded-2xl px-4 py-2.5 md:px-5 md:py-3 shadow-sm ${isUser
                        ? "text-white"
                        : "bg-white border border-gray-100 text-gray-800"
                        } ${hasApproved ? "border-2 border-emerald-500" : ""} ${hasBlocked ? "border-2 border-red-500" : ""}`}
                    style={isUser ? { background: "#E8793A" } : undefined}
                >
                    {isUser ? (
                        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                            {content}
                        </p>
                    ) : (
                        <div className="prose prose-sm md:prose-base max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-orange-700">
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => (
                                        <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                                    ),
                                    h1: ({ children }) => (
                                        <h1 className="text-xl font-bold mb-3 gradient-text">
                                            {children}
                                        </h1>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-lg font-bold mb-2 text-gray-800">
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-base font-semibold mb-2 text-gray-700">
                                            {children}
                                        </h3>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc list-inside mb-3 space-y-1 text-gray-700">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-700">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="ml-2">{children}</li>
                                    ),
                                    code: ({ children, className }) => {
                                        const isInline = !className;
                                        return isInline ? (
                                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-orange-700 text-xs font-semibold border border-gray-200">
                                                {children}
                                            </code>
                                        ) : (
                                            <code className="block bg-gray-900 text-white p-3 rounded-lg text-xs overflow-x-auto custom-scrollbar shadow-inner">
                                                {children}
                                            </code>
                                        );
                                    },
                                    strong: ({ children }) => (
                                        <strong className="font-semibold text-gray-900">
                                            {children}
                                        </strong>
                                    ),
                                    em: ({ children }) => (
                                        <em className="italic text-gray-500">{children}</em>
                                    ),
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                            {isStreaming && (
                                <span className="inline-block w-2 h-4 animate-pulse ml-1" style={{ backgroundColor: '#E8793A' }} />
                            )}
                        </div>
                    )}
                </div>
                <div
                    className={`text-xs text-gray-500 mt-1 px-2 ${isUser ? "text-right" : "text-left"}`}
                >
                    {isStreaming ? (
                        <span style={{ color: '#E8793A' }}>Generating...</span>
                    ) : (
                        new Date(timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
