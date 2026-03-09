"use client";

import React, { useState, FormEvent, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatStore } from "@/store/chat-store";

function FeedbackForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const conversationId = searchParams.get("conversationId");

    // Pull the interview completion state from the global store
    const { isInterviewComplete } = useChatStore();

    const [rating, setRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [reflectionScore, setReflectionScore] = useState<number>(0);
    const [difficulties, setDifficulties] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Verify access when component mounts
    useEffect(() => {
        setIsMounted(true);
        // Only allow access if the store explicitly says the interview is complete,
        // OR if a valid conversationId is passed (as an extra fallback)
        if (!isInterviewComplete && !conversationId) {
            setUnauthorized(true);
            const timer = setTimeout(() => {
                router.push("/");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isInterviewComplete, conversationId, router]);

    // Prevent hydration mismatch and form flashing
    if (!isMounted) {
        return null;
    }

    if (unauthorized) {
        return (
            <div className="flex flex-col items-center justify-center flex-1 h-[60vh] text-center space-y-6 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-600 max-w-md">This page is only accessible after completing an interview. Redirecting you home...</p>
            </div>
        );
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (rating === 0 || reflectionScore === 0) {
            alert("Please complete the rating scales before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId: conversationId ? parseInt(conversationId) : 0,
                    rating,
                    reflectionScore,
                    difficulties,
                }),
            });

            if (res.ok) {
                setSubmitted(true);
                // Redirect back to home after 3 seconds
                setTimeout(() => {
                    router.push("/");
                }, 3000);
            } else {
                alert("There was an error submitting your feedback. Please try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-6 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Thank You!</h2>
                <p className="text-gray-600 max-w-md">Your feedback has been recorded. Redirecting you back to the home page...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto py-4 px-6 flex flex-col h-full min-h-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Your application has been submitted successfully!
            </h1>
            <p className="text-gray-600 mb-4 text-lg flex-none">
                Your feedback will help us improve this process for other founders.
            </p>

            <div className="space-y-4 md:space-y-6 flex-1 min-h-0 overflow-y-auto pr-2 pb-2">
                {/* Application Experience Rating */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <label className="text-lg font-medium text-gray-800 md:w-1/2">
                        How would you rate the overall application experience?
                    </label>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className="focus:outline-none transition-transform hover:scale-110"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                            >
                                <svg
                                    className={`w-10 h-10 ${(hoverRating || rating) >= star
                                        ? "text-[#E8793A]"
                                        : "text-gray-300"
                                        } transition-colors duration-200`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reflection Scale */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <label className="text-lg font-medium text-gray-800 md:w-1/2">
                        Would you say the process helped you reflect deeply about yourself and your startup?
                    </label>
                    <div className="flex flex-col gap-2 w-full md:w-1/2">
                        <div className="flex justify-between text-xs text-gray-500 font-medium px-1">
                            <span>Strongly disagree</span>
                            <span>Strongly agree</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 rounded-full px-6 py-4 shadow-inner">
                            {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setReflectionScore(val)}
                                    className="relative flex items-center justify-center w-8 h-8 focus:outline-none group"
                                >
                                    <div
                                        className={`w-6 h-6 rounded-full transition-all duration-200 ${reflectionScore === val
                                            ? "bg-[#E8793A] scale-125 shadow-md"
                                            : "bg-gray-300 group-hover:bg-gray-400"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Difficulties */}
                <div className="flex flex-col gap-3">
                    <label className="text-lg font-medium text-gray-800">
                        Did you experience any difficulties during the process?
                    </label>
                    <textarea
                        value={difficulties}
                        onChange={(e) => setDifficulties(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E8793A] focus:border-transparent min-h-[80px] resize-none"
                        placeholder="Share your thoughts here (optional)..."
                    />
                </div>
            </div>

            <div className="mt-4 flex-none flex flex-col md:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 max-w-md">
                    In case you faced a major issue in submitting your application, write to us at{" "}
                    <a href="mailto:buildai@itelfoundation.in" className="text-blue-600 hover:underline">
                        buildai@itelfoundation.in
                    </a>
                </p>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-10 py-3.5 bg-[#E8793A] hover:bg-[#d06d34] text-white font-semibold rounded-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Submitting..." : "Submit"}
                </button>
            </div>
        </form>
    );
}

export default function FeedbackPage() {
    return (
        <div className="h-screen bg-white overflow-hidden flex flex-col">
            {/* Header matching the homepage design */}
            <header
                style={{
                    background: "linear-gradient(to right, #0a0818, #4e35b7)",
                }}
                className="w-full px-6 md:px-12 py-4 flex flex-col items-center justify-center text-center gap-1 md:flex-row md:justify-between md:text-left md:gap-0"
            >
                <h2 className="text-white text-[28px] md:text-2xl tracking-wide font-semibold">
                    <span>Build</span>
                    <span style={{ color: "#E8793A" }}>AI</span>
                    <span> Pitch Event</span>
                </h2>
                <p className="text-white/80 text-xs md:text-sm font-light">
                    A Joint event of IndiaAI Mission and ITEL Foundation
                </p>
            </header>

            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading feedback form...</div>}>
                    <FeedbackForm />
                </Suspense>
            </main>
        </div>
    );
}
