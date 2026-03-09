"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PoweredByBadge from "@/components/PoweredByBadge";

export default function InfoPage() {
    const router = useRouter();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring" as const,
                stiffness: 100,
                damping: 10,
            },
        },
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans overflow-x-hidden">
            {/* Header */}
            <motion.header
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                    background: "linear-gradient(to right, #0a0818, #4e35b7)",
                }}
                className="w-full flex-none px-6 md:px-12 py-4 flex flex-col items-center justify-center text-center gap-1 md:flex-row md:justify-between md:text-left md:gap-0 z-30 relative shadow-md"
            >
                <h2 className="text-white text-[28px] md:text-2xl tracking-wide font-semibold">
                    <span>Build</span>
                    <span style={{ color: "#E8793A" }}>AI</span>
                    <span> Pitch Event</span>
                </h2>
                <p className="text-white/80 text-xs md:text-sm font-light">
                    A Joint event of IndiaAI Mission and ITEL Foundation
                </p>
            </motion.header>

            <PoweredByBadge />

            {/* Back Button Container */}
            <div className="w-full px-4 md:px-8 pt-3 md:pt-4 flex-none relative z-20">
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group w-fit"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 md:h-6 md:w-6 group-hover:-translate-x-1 transition-transform"
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
                    <span className="text-base md:text-lg font-medium">Back</span>
                </motion.button>
            </div>

            <main className="relative z-10 flex-grow flex flex-col justify-start md:justify-center max-w-5xl w-full mx-auto px-4 md:px-20 py-2 md:py-4 pb-20 md:pb-8">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col h-full justify-start md:justify-center mt-0 md:mt-0"
                >
                    <motion.h1
                        variants={itemVariants}
                        className="text-base md:text-2xl mb-2 md:mb-4 text-center md:text-left mt-0 md:mt-0 font-medium text-gray-900"
                    >
                        Welcome to the <span className="font-bold">Build<span style={{ color: "#E8793A" }}>AI</span></span> Pitch Event application.
                    </motion.h1>

                    <div className="flex flex-col gap-1.5 md:gap-2 text-gray-600 text-[12px] md:text-[15px] leading-snug max-w-4xl bg-white/60 p-3 md:p-5 rounded-xl md:rounded-2xl shadow-lg border border-white/40 backdrop-blur-sm">
                        <motion.p
                            variants={itemVariants}
                            className="font-medium text-gray-900 text-[12.5px] md:text-base leading-tight md:leading-snug"
                        >
                            IndiaAI Mission along with ITEL intends to identify, incubate, and nurture AI startups across the country through ITEL&apos;s Pitch event
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            You are about to begin a guided conversation where we will get to
                            know you, your venture, and explore your thinking as a founder.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            We encourage you to answer thoughtfully and honestly. There are no
                            &quot;right&quot; or &quot;wrong&quot; answers. Your responses help us understand your
                            business, the people behind it, and the opportunities that lie
                            ahead.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            All responses are treated as strictly confidential and will only be
                            reviewed by the ITEL management team.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            The process takes 20-40 minutes. There is no time
                            limit.
                        </motion.p>

                        <motion.p
                            variants={itemVariants}
                            className="text-gray-800 font-medium"
                        >
                            Please begin when you are ready — take your time, reflect, and
                            share your story.
                        </motion.p>

                        <motion.div
                            variants={itemVariants}
                            className="mt-2 md:mt-4 flex justify-center md:justify-start w-full"
                        >
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => router.push("/chat")}
                                style={{ backgroundColor: "#E8793A" }}
                                className="w-full md:w-auto px-6 py-2 md:px-8 text-white text-[13px] md:text-lg font-medium rounded-full shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all duration-200 whitespace-nowrap"
                            >
                                I&apos;m ready to begin the conversation
                            </motion.button>
                        </motion.div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}