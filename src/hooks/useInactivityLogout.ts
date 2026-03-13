import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in ms
const WARNING_BEFORE = 5 * 60 * 1000; // warn 5 min before logout

export const useInactivityLogout = (enabled: boolean = true) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningToastRef = useRef<{ dismiss: () => void } | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const logout = useCallback(async () => {
    clearTimers();
    await supabase.auth.signOut();
    toast({
      title: "Session expired",
      description: "You were logged out due to 1 hour of inactivity.",
      variant: "destructive",
    });
  }, [clearTimers]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    // Dismiss any existing warning toast
    warningToastRef.current?.dismiss();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      const { dismiss } = toast({
        title: "Session expiring soon",
        description: "You'll be logged out in 5 minutes due to inactivity.",
        duration: WARNING_BEFORE,
      });
      warningToastRef.current = { dismiss };
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    // Set logout timer
    timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  }, [enabled, clearTimers, logout]);

  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"];

    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start on mount

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [enabled, resetTimer, clearTimers]);
};
