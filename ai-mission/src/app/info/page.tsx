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
        <div className="relative min-h-screen bg-white flex flex-col items-center justify-center font-sans overflow-x-hidden">
            <PoweredByBadge />

            {/* Back Button */}
            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                onClick={() => router.push("/")}
                className="absolute top-4 left-4 md:top-8 md:left-8 z-20 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
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

            <main className="relative z-10 flex-grow flex flex-col justify-start md:justify-center max-w-5xl w-full mx-auto px-4 md:px-20 pt-24 md:pt-0 pb-6 md:pb-12">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col h-full justify-start md:justify-center"
                >
                    <motion.h1
                        variants={itemVariants}
                        className="text-3xl md:text-4xl mb-4 md:mb-6 text-center md:text-left mt-0 md:mt-0"
                    >
                        <span className="font-light text-gray-800">Welcome to </span>
                        <span className="font-bold text-gray-900">FounderCheck</span>
                    </motion.h1>

                    <div className="space-y-1 md:space-y-1 text-gray-600 text-sm md:text-base font-light leading-relaxed max-w-4xl bg-white/60 p-5 md:p-6 rounded-xl md:rounded-2xl shadow-lg border border-white/40 backdrop-blur-sm">
                        <motion.p
                            variants={itemVariants}
                            className="text-lg md:text-xl font-medium text-gray-900"
                        >
                            Welcome to the Build AI Pitch Event application.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            You are about to begin a guided conversation where we will get to
                            know you, your venture, and explore your thinking as a founder.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            We encourage you to answer thoughtfully and honestly. There are no
                            &quot;right&quot; answers. Your responses help us understand your
                            business, the people behind it, and the opportunities that lie
                            ahead.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            All responses are treated as strictly confidential and will only be
                            reviewed by the ITEL management team.
                        </motion.p>

                        <motion.p variants={itemVariants}>
                            The process takes approximately 30 minutes. There is no time
                            limit.
                        </motion.p>

                        <motion.p
                            variants={itemVariants}
                            className="text-gray-800 font-normal pt-1"
                        >
                            Please begin when you are ready — take your time, reflect, and
                            share your story.
                        </motion.p>
                    </div>

                    <motion.div
                        variants={itemVariants}
                        className="mt-2 md:mt-6 mb-4 md:mb-0 flex justify-center md:justify-start"
                    >
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push("/chat")}
                            style={{ backgroundColor: "#E8793A" }}
                            className="group relative px-6 py-2.5 md:px-8 text-white text-sm md:text-lg font-medium rounded-full shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all duration-200 whitespace-nowrap"
                        >
                            I&apos;m ready to begin the conversation
                        </motion.button>
                    </motion.div>
                </motion.div>
            </main>
        </div>
    );
}
