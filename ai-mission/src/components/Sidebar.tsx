"use client";

import React, { useState } from "react";

interface Conversation {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: number | null;
    onSelectConversation: (id: number | null) => void;
    onNewConversation: () => void;
    onDeleteConversation: (id: number) => void;
    onRenameConversation: (id: number, title: string) => void;
    onClose?: () => void;
}

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewConversation,
    onDeleteConversation,
    onRenameConversation,
    onClose,
}: SidebarProps) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");

    const startEditing = (
        id: number,
        currentTitle: string,
        e: React.MouseEvent
    ) => {
        e.stopPropagation();
        setEditingId(id);
        setEditTitle(currentTitle);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditTitle("");
    };

    const saveTitle = async (id: number, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!editTitle.trim()) {
            cancelEditing();
            return;
        }
        onRenameConversation(id, editTitle.trim());
        cancelEditing();
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this conversation?")) return;
        onDeleteConversation(id);
    };

    return (
        <div className="w-full h-full glass border-r border-white/20 flex flex-col bg-white/40">
            {/* Header */}
            <div className="p-4 border-b border-white/20">
                <div className="flex items-center justify-between mb-4">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => (window.location.href = "/")}
                    >
                        <div className="p-1.5 rounded-lg hover:bg-orange-100 transition-colors">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-gray-500 group-hover:text-orange-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                />
                            </svg>
                        </div>
                        <h4 className="text-xl font-medium text-gray-900">FounderCheck</h4>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="md:hidden p-2 text-gray-500 hover:text-orange-700"
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
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    )}
                </div>
                <button
                    onClick={onNewConversation}
                    className="btn-primary w-full shadow-orange-500/20"
                >
                    + New Conversation
                </button>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {conversations.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8 px-4">
                        <p className="text-sm">No conversations yet. Start a new one!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {conversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() =>
                                    editingId !== conv.id && onSelectConversation(conv.id)
                                }
                                className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeConversationId === conv.id
                                    ? "bg-orange-100/50 border border-orange-200 shadow-sm"
                                    : "hover:bg-white/50 border border-transparent"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        {editingId === conv.id ? (
                                            <form
                                                onSubmit={(e) => saveTitle(conv.id, e)}
                                                className="flex flex-col gap-2"
                                            >
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onBlur={() => saveTitle(conv.id)}
                                                    autoFocus
                                                    className="w-full bg-white text-sm text-gray-800 px-2 py-1 rounded border border-orange-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </form>
                                        ) : (
                                            <>
                                                <h3
                                                    className={`text-sm font-medium truncate ${activeConversationId === conv.id
                                                        ? "text-gray-900"
                                                        : "text-gray-700"
                                                        }`}
                                                >
                                                    {conv.title}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(conv.updated_at || conv.created_at).toLocaleDateString()}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    {editingId !== conv.id && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => startEditing(conv.id, conv.title, e)}
                                                className="text-gray-400 hover:text-orange-600 p-1"
                                                title="Edit title"
                                            >
                                                <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(conv.id, e)}
                                                className="text-gray-400 hover:text-red-500 p-1"
                                                title="Delete conversation"
                                            >
                                                <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/20">
                <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0"></div>
                    <div>
                        <p className="text-xs font-medium text-gray-600">Powered by ITEL</p>
                        <p className="text-xs text-gray-400 font-light">
                            Immersive Technology Entrepreneurship Labs
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
