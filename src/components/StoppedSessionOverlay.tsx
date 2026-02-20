"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Play } from "@/components/Icons";

interface StoppedSessionOverlayProps {
  sessionName: string | null;
  onResume: () => Promise<void>;
  resuming?: boolean;
}

// Fake terminal content — looks like a Claude conversation with code
const TERMINAL_LINES = [
  { color: "text-violet-500/60", text: "╭──────────────────────────────────────────────╮" },
  { color: "text-violet-500/60", text: "│  Claude Code           session: dev-server    │" },
  { color: "text-violet-500/60", text: "╰──────────────────────────────────────────────╯" },
  { color: "text-zinc-700", text: "" },
  { color: "text-emerald-600/50", text: "❯ Помоги написать API для аутентификации" },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-600/70", text: "  Создам систему аутентификации с JWT токенами." },
  { color: "text-zinc-600/70", text: "  Начну с маршрута для входа и middleware." },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-500/50", text: "  src/auth/route.ts" },
  { color: "text-violet-500/40", text: "  import" + " { NextRequest } " + "from" + " 'next/server';" },
  { color: "text-violet-500/40", text: "  import" + " { SignJWT, jwtVerify } " + "from" + " 'jose';" },
  { color: "text-zinc-700", text: "" },
  { color: "text-cyan-600/40", text: "  const" + " SECRET = " + "new" + " TextEncoder().encode(" },
  { color: "text-amber-600/40", text: '    process.env.JWT_SECRET || "fallback-secret"' },
  { color: "text-cyan-600/40", text: "  );" },
  { color: "text-zinc-700", text: "" },
  { color: "text-blue-500/40", text: "  export async function" + " POST(req: NextRequest) {" },
  { color: "text-zinc-600/50", text: "    const { username, password } = await req.json();" },
  { color: "text-zinc-600/50", text: "    const isValid = await verifyCredentials(username," },
  { color: "text-zinc-600/50", text: "      password);" },
  { color: "text-zinc-700", text: "" },
  { color: "text-emerald-600/40", text: "    if (isValid) {" },
  { color: "text-zinc-600/50", text: "      const token = await new SignJWT({ sub: username })" },
  { color: "text-zinc-600/50", text: "        .setProtectedHeader({ alg: 'HS256' })" },
  { color: "text-zinc-600/50", text: "        .setExpirationTime('24h')" },
  { color: "text-zinc-600/50", text: "        .sign(SECRET);" },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-600/50", text: "      return Response.json({ token });" },
  { color: "text-emerald-600/40", text: "    }" },
  { color: "text-zinc-700", text: "" },
  { color: "text-red-500/30", text: "    return Response.json(" },
  { color: "text-red-500/30", text: "      { error: 'Invalid credentials' }," },
  { color: "text-red-500/30", text: "      { status: 401 }" },
  { color: "text-red-500/30", text: "    );" },
  { color: "text-blue-500/40", text: "  }" },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-600/70", text: "  Добавил маршрут аутентификации. Теперь создам" },
  { color: "text-zinc-600/70", text: "  middleware для проверки токена на защищённых" },
  { color: "text-zinc-600/70", text: "  маршрутах." },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-500/50", text: "  src/middleware.ts" },
  { color: "text-violet-500/40", text: "  import" + " { NextResponse } " + "from" + " 'next/server';" },
  { color: "text-cyan-600/40", text: "  const" + " protectedPaths = ['/dashboard', '/api/'];" },
  { color: "text-zinc-700", text: "" },
  { color: "text-emerald-600/50", text: "❯ Теперь добавь rate limiting" },
  { color: "text-zinc-700", text: "" },
  { color: "text-zinc-600/70", text: "  Хорошо, добавлю ограничение запросов на основе" },
  { color: "text-zinc-600/70", text: "  IP адреса — максимум 5 попыток за 15 минут." },
];

export default function StoppedSessionOverlay({
  sessionName,
  onResume,
  resuming: externalResuming,
}: StoppedSessionOverlayProps) {
  const [internalResuming, setInternalResuming] = useState(false);
  const isResuming = externalResuming || internalResuming;

  const handleResume = async () => {
    setInternalResuming(true);
    try {
      await onResume();
    } catch {
      setInternalResuming(false);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a0a] rounded-xl">
      {/* Fake terminal background */}
      <div className="absolute inset-0 overflow-hidden select-none pointer-events-none">
        <div className="p-3 md:p-5 font-mono text-[10px] md:text-xs leading-relaxed md:leading-relaxed">
          {TERMINAL_LINES.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
              className={line.color}
            >
              {line.text || "\u00A0"}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Gradient overlays — fade the fake terminal */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-[#0a0a0a]/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/30 via-transparent to-transparent" />

      {/* Blur layer over the text */}
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      {/* Centered content */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center text-center max-w-sm"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center mb-5 md:mb-6"
          >
            {isResuming ? (
              <div className="w-7 h-7 md:w-8 md:h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-6 md:h-7 rounded-full bg-violet-500/60" />
                <div className="w-1.5 h-6 md:h-7 rounded-full bg-violet-500/60" />
              </div>
            )}
          </motion.div>

          {/* Title */}
          <h2 className="text-lg md:text-xl font-medium text-zinc-200 mb-2">
            {isResuming ? "Возобновление..." : "Сессия остановлена"}
          </h2>

          {/* Session name */}
          {sessionName && (
            <p className="text-sm text-zinc-500 mb-1 font-mono truncate max-w-[250px] md:max-w-[300px]">
              {sessionName}
            </p>
          )}

          {/* Description */}
          <p className="text-sm text-zinc-600 mb-6 md:mb-8 leading-relaxed">
            {isResuming
              ? "Запускаем CLI и подключаем терминал..."
              : <>Процесс CLI завершён. Возобновите сессию,<br className="hidden md:block" />{" "}чтобы продолжить работу.</>
            }
          </p>

          {/* Resume button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleResume}
            disabled={isResuming}
            className="flex items-center gap-2.5 px-6 py-3 md:px-7 md:py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-wait shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
          >
            {isResuming ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Возобновление...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Возобновить сессию</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
