"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import LoginForm from "@/components/LoginForm";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/check")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <AuroraBackground className="dark:bg-black">
      <div className="relative z-10 flex flex-col items-center justify-center gap-8 px-4">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl shadow-2xl shadow-violet-500/30">
          C
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-300 to-zinc-500">
            Claude Terminal
          </h1>
          <p className="mt-4 text-zinc-400 text-lg max-w-md mx-auto">
            Веб-интерфейс для Claude CLI. Полный доступ к терминалу из браузера.
          </p>
        </div>

        {/* Auth section */}
        {isAuthenticated === null ? (
          <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
        ) : isAuthenticated ? (
          <HoverBorderGradient
            as="button"
            containerClassName=""
            className="flex items-center gap-2 bg-zinc-900 text-white px-8 py-4 text-lg"
            onClick={() => router.push("/dashboard")}
          >
            Начать общение →
          </HoverBorderGradient>
        ) : (
          <LoginForm />
        )}
      </div>
    </AuroraBackground>
  );
}
