"use client";

export type OS = "mac" | "windows" | "linux";

export function getOS(): OS {
  if (typeof navigator === "undefined") return "linux";
  const platform =
    // @ts-expect-error — userAgentData not in all TS libs yet
    (navigator.userAgentData?.platform as string) ??
    navigator.platform ??
    "";
  if (/mac/i.test(platform)) return "mac";
  if (/win/i.test(platform)) return "windows";
  return "linux";
}

export function useOS(): OS {
  return getOS();
}
