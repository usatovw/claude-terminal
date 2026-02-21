"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface User {
  userId: number;
  login: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "guest";
}

interface UserContextValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isGuest: false,
});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/check")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isGuest = user?.role === "guest";

  return (
    <UserContext.Provider value={{ user, loading, isGuest }}>
      {children}
    </UserContext.Provider>
  );
}
