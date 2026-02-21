"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();
  const savedThemeRef = useRef<string | null>(null);

  // Force dark theme on 404 page
  useEffect(() => {
    savedThemeRef.current = document.documentElement.getAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme");
    return () => {
      if (savedThemeRef.current) {
        document.documentElement.setAttribute("data-theme", savedThemeRef.current);
      }
    };
  }, []);

  return (
    <LampContainer>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: "easeInOut" }}
        className="flex flex-col items-center gap-6"
      >
        <h1 className="text-8xl md:text-9xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-violet-300 to-violet-600 tracking-tighter">
          404
        </h1>
        <p className="text-muted-fg text-lg md:text-xl text-center max-w-md">
          Здесь ничего нет. Совсем.
        </p>
        <HoverBorderGradient
          as="button"
          containerClassName=""
          className="flex items-center gap-2 bg-surface-alt text-foreground px-8 py-3 text-sm"
          onClick={() => router.push("/")}
        >
          На главную
        </HoverBorderGradient>
      </motion.div>
    </LampContainer>
  );
}
