"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LandingPage() {
  const router = useRouter();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          background: "linear-gradient(to right, #0a0818, #2d1b69)",
        }}
        className="w-full px-6 md:px-12 py-4 flex flex-col items-center justify-center text-center gap-1 md:flex-row md:justify-between md:text-left md:gap-0"
      >
        <h2 className="text-white text-xl md:text-2xl tracking-wide">
          <span className="font-light">Build</span>
          <span className="font-bold" style={{ color: "#E8793A" }}>
            AI
          </span>
          <span className="font-light"> Pitch Event</span>
        </h2>
        <p className="text-white/80 text-xs md:text-sm font-light">
          A Joint event of IndiaAI Mission and ITEL Foundation
        </p>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 bg-white flex flex-col items-center justify-between px-6 text-center py-12 overflow-hidden">
        {/* Push content down further */}
        <div className="flex-[1.5]"></div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl text-gray-900 mb-4 tracking-tight leading-snug text-center">
            <span className="block md:inline font-light">Welcome to </span>
            <span className="block md:inline font-bold">Founder Check</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-gray-500 text-base md:text-lg mb-10 font-light">
            ITEL&apos;s Interactive Screening Application
          </motion.p>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/info")}
            style={{ backgroundColor: "#E8793A" }}
            className="px-10 py-3 text-white text-base md:text-lg font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-200"
          >
            Apply Now
          </motion.button>
        </motion.div>

        {/* Logos pushed to bottom with flex-1 on top */}
        <div className="flex-1 flex flex-col justify-end mt-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex items-center gap-6 md:gap-8 justify-center"
          >
            <Image
              src="/India AI logo.png"
              alt="IndiaAI"
              width={100}
              height={35}
              className="object-contain"
            />
            <Image
              src="/logo.png"
              alt="ITEL Foundation"
              width={85}
              height={35}
              className="object-contain"
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
