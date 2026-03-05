"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const PoweredByBadge = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
            className="fixed top-4 right-4 md:top-8 md:right-8 z-50 flex items-center justify-center gap-2 px-3 py-1.5 md:px-4 md:py-2 
                 bg-transparent backdrop-blur-sm rounded-full
                 transition-all duration-300 hover:bg-white/10"
        >
            <span className="text-[10px] md:text-sm text-gray-500 font-light tracking-wide">
                Powered by
            </span>
            <Image
                src="/logo.png"
                alt="ITEL"
                width={60}
                height={24}
                className="object-contain"
            />
        </motion.div>
    );
};

export default PoweredByBadge;
