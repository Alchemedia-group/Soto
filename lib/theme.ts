"use client";
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "soto:theme"; // per device on purpose: phone and computer can differ
const subs = new Set<() => void>();

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const systemDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  // phone status-bar / browser chrome colour
  const dark = t === "dark" || (t === "system" && systemDark());
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0d1419" : "#0a2342"));
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  applyTheme(t);
  subs.forEach((s) => s());
}

/** Call once at start: re-applies the saved choice and follows system changes / other tabs. */
export function initTheme() {
  applyTheme(getTheme());
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSys = () => { if (getTheme() === "system") applyTheme("system"); };
  mq.addEventListener?.("change", onSys);
  window.addEventListener("storage", (e) => { if (e.key === KEY) { applyTheme(getTheme()); subs.forEach((s) => s()); } });
}

export const useTheme = (): Theme =>
  useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    getTheme,
    () => "system",
  );
