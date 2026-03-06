"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import { useChatStore } from "@/store/chat-store";

const API_BASE = "";

export default function ChatPage() {
    const {
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
        messages,
        setMessages,
        addMessage,
        isLoading,
        setIsLoading,
        isInterviewComplete,
        setIsInterviewComplete,
    } = useChatStore();

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);

    // Load conversations on mount
    const loadConversations = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/conversations`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (err) {
            console.error("Error loading conversations:", err);
        }
    }, [setConversations]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Load messages when active conversation changes
    useEffect(() => {
        if (!activeConversationId) {
            setMessages([]);
            setIsInterviewComplete(false);
            return;
        }

        const loadMessages = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/api/conversations/${activeConversationId}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                    if (data.interviewState) {
                        setIsInterviewComplete(data.interviewState.is_complete || false);
                    }
                }
            } catch (err) {
                console.error("Error loading messages:", err);
            }
        };

        loadMessages();
    }, [activeConversationId, setMessages, setIsInterviewComplete]);

    // Create new conversation
    const handleNewConversation = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/conversations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "New Conversation" }),
            });

            if (res.ok) {
                const conv = await res.json();
                setActiveConversationId(conv.id);
                await loadConversations();
            }
        } catch (err) {
            console.error("Error creating conversation:", err);
        }
    };

    // Send message
    const handleSendMessage = async (content: string) => {
        if (isLoading) return;

        setIsLoading(true);

        // Optimistically add user message
        const tempUserMsg = {
            id: Date.now(),
            role: "user" as const,
            content,
            created_at: new Date().toISOString(),
        };
        addMessage(tempUserMsg);

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId: activeConversationId,
                    content,
                }),
            });

            if (res.ok) {
                const data = await res.json();

                if (!activeConversationId && data.conversationId) {
                    setActiveConversationId(data.conversationId);
                }

                addMessage({
                    id: Date.now() + 1,
                    role: "assistant",
                    content: data.response,
                    created_at: new Date().toISOString(),
                });

                if (data.isComplete) {
                    setIsInterviewComplete(true);
                }

                if (data.currentStepId !== undefined) {
                    setCurrentStepId(data.currentStepId);
                }

                await loadConversations();
            } else {
                const errData = await res.json().catch(() => ({}));
                addMessage({
                    id: Date.now() + 1,
                    role: "assistant",
                    content: `⚠️ Error: ${errData.error || "Something went wrong. Please try again."}`,
                    created_at: new Date().toISOString(),
                });
            }
        } catch (err) {
            console.error("Error sending message:", err);
            addMessage({
                id: Date.now() + 1,
                role: "assistant",
                content:
                    "⚠️ Network error. Please check your connection and try again.",
                created_at: new Date().toISOString(),
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Delete conversation
    const handleDeleteConversation = async (id: number) => {
        try {
            await fetch(`${API_BASE}/api/conversations/${id}`, { method: "DELETE" });
            if (activeConversationId === id) {
                setActiveConversationId(null);
            }
            await loadConversations();
        } catch (err) {
            console.error("Error deleting conversation:", err);
        }
    };

    // Rename conversation
    const handleRenameConversation = async (id: number, title: string) => {
        try {
            await fetch(`${API_BASE}/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            await loadConversations();
        } catch (err) {
            console.error("Error renaming conversation:", err);
        }
    };

    return (
        <div className="fixed inset-0 flex overflow-hidden bg-transparent">
            {/* Mobile Sidebar Overlay */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-800/40 z-[55] md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed inset-y-0 left-0 z-[60] w-80 transform transition-transform duration-300 ease-in-out border-r border-white/20
          md:relative md:translate-x-0 md:w-80 md:border-r md:border-white/20
          ${mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
            >
                <Sidebar
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={(id) => {
                        setActiveConversationId(id);
                        setMobileSidebarOpen(false);
                    }}
                    onNewConversation={handleNewConversation}
                    onDeleteConversation={handleDeleteConversation}
                    onRenameConversation={handleRenameConversation}
                    onClose={() => setMobileSidebarOpen(false)}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 w-full h-full relative">
                {/* Mobile Header */}
                <div className="md:hidden flex-none flex items-center justify-between p-4 border-b border-white/20 bg-white/60 backdrop-blur-md z-30 sticky top-0">
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="p-2 -ml-2 text-gray-600 hover:text-green-700 rounded-lg hover:bg-white/50 transition-colors"
                        aria-label="Open menu"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                    <span className="font-bold text-lg text-green-800">FounderCheck</span>
                    <button
                        onClick={() => (window.location.href = "/")}
                        className="p-2 -mr-2 text-gray-600 hover:text-green-700 rounded-lg hover:bg-white/50 transition-colors"
                        aria-label="Back to Home"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 min-h-0 relative">
                    <ChatInterface
                        conversationId={activeConversationId}
                        messages={messages}
                        isLoading={isLoading}
                        isInterviewComplete={isInterviewComplete}
                        currentStepId={currentStepId}
                        onSendMessage={handleSendMessage}
                        onNewConversation={handleNewConversation}
                    />
                </div>
            </div>
        </div>
    );
}
