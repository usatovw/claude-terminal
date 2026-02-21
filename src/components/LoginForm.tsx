"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

type AuthMode = "login" | "register" | "guest";

export default function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    resetMessages();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Ошибка авторизации");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          login,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || "Заявка отправлена");
        // Clear form
        setFirstName("");
        setLastName("");
        setLogin("");
        setPassword("");
      } else {
        setError(data.error || "Ошибка регистрации");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guestCode }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Ошибка входа");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-zinc-900/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors";

  return (
    <div className="flex flex-col gap-5 w-full max-w-sm">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/50">
        {([
          { key: "login", label: "Вход" },
          { key: "register", label: "Регистрация" },
          { key: "guest", label: "Гость" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              mode === key
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Login form */}
      {mode === "login" && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин"
            className={inputClass}
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className={inputClass}
            required
            autoComplete="current-password"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <HoverBorderGradient
            as="button"
            containerClassName="w-full"
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              "Войти"
            )}
          </HoverBorderGradient>
        </form>
      )}

      {/* Register form */}
      {mode === "register" && (
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Имя *"
              className={inputClass}
              required
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Фамилия"
              className={inputClass}
            />
          </div>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин *"
            className={inputClass}
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль *"
            className={inputClass}
            required
            minLength={4}
            autoComplete="new-password"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {success && <p className="text-amber-400 text-sm text-center">{success}</p>}

          <HoverBorderGradient
            as="button"
            containerClassName="w-full"
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              "Отправить заявку"
            )}
          </HoverBorderGradient>
        </form>
      )}

      {/* Guest form */}
      {mode === "guest" && (
        <form onSubmit={handleGuest} className="flex flex-col gap-4">
          <input
            type="text"
            value={guestCode}
            onChange={(e) => setGuestCode(e.target.value)}
            placeholder="Код доступа"
            className={inputClass}
            required
            autoComplete="off"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <HoverBorderGradient
            as="button"
            containerClassName="w-full"
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              "Войти как гость"
            )}
          </HoverBorderGradient>
        </form>
      )}
    </div>
  );
}
