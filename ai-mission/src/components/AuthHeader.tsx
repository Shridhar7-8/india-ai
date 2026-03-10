"use client";

import { usePathname } from "next/navigation";
import {
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
} from "@clerk/nextjs";

export default function AuthHeader() {
    const pathname = usePathname();

    // Hide auth header entirely on the landing page and info page since the main action buttons handle auth flow
    if (pathname === "/" || pathname === "/info") {
        return null;
    }

    return (
        <header className="absolute top-0 right-0 p-4 z-50 pointer-events-auto flex justify-end items-center gap-4 h-16 w-full max-w-sm">
            <SignedOut>
                <SignInButton fallbackRedirectUrl="/chat" forceRedirectUrl="/chat" />
                <SignUpButton fallbackRedirectUrl="/chat" forceRedirectUrl="/chat">
                    <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                        Sign Up
                    </button>
                </SignUpButton>
            </SignedOut>
            <SignedIn>
                <UserButton />
            </SignedIn>
        </header>
    );
}
