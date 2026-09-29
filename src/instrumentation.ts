export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recoverStuckWork } = await import("@/lib/pipeline");
  const { deleteExpiredSessions } = await import("@/lib/auth/session");
  const { deleteOldAttempts } = await import("@/lib/auth/rate-limit");

  const tick = async () => {
    try {
      await recoverStuckWork();
      await deleteExpiredSessions();
      await deleteOldAttempts();
    } catch (error) {
      console.error("Hintergrundlauf fehlgeschlagen", error);
    }
  };

  // Nicht auf den ersten Lauf warten, der Server soll sofort Anfragen annehmen
  void tick();
  setInterval(tick, 5 * 60 * 1000).unref();
}
