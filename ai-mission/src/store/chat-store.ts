import { create } from "zustand";

interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    isStreaming?: boolean;
}

interface Conversation {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface ChatState {
    // State
    conversations: Conversation[];
    activeConversationId: number | null;
    messages: Message[];
    isLoading: boolean;
    isInterviewComplete: boolean;
    currentPhase: string;

    // Actions
    setConversations: (conversations: Conversation[]) => void;
    setActiveConversationId: (id: number | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateLastAssistantMessage: (content: string) => void;
    setIsLoading: (loading: boolean) => void;
    setIsInterviewComplete: (complete: boolean) => void;
    setCurrentPhase: (phase: string) => void;
    reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    // Initial state
    conversations: [],
    activeConversationId: null,
    messages: [],
    isLoading: false,
    isInterviewComplete: false,
    currentPhase: "Phase 1 - Founder",

    // Actions
    setConversations: (conversations) => set({ conversations }),
    setActiveConversationId: (id) => set({ activeConversationId: id }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
    updateLastAssistantMessage: (content) =>
        set((state) => {
            const msgs = [...state.messages];
            const lastIdx = msgs.findLastIndex((m) => m.role === "assistant");
            if (lastIdx !== -1) {
                msgs[lastIdx] = { ...msgs[lastIdx], content };
            }
            return { messages: msgs };
        }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setIsInterviewComplete: (complete) => set({ isInterviewComplete: complete }),
    setCurrentPhase: (phase) => set({ currentPhase: phase }),
    reset: () =>
        set({
            conversations: [],
            activeConversationId: null,
            messages: [],
            isLoading: false,
            isInterviewComplete: false,
            currentPhase: "Phase 1 - Grit",
        }),
}));
