"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  LockKeyhole,
  Mail,
} from "lucide-react";
type Mode = "forgot" | "reset" | "verify";
export default function AccountRecovery({ mode }: { mode: Mode }) {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
    setReady(true);
  }, []);
  const verifyToken = mode === "verify" && !!token;
  const action =
    mode === "forgot"
      ? "forgot-password"
      : mode === "reset"
        ? "reset-password"
        : verifyToken
          ? "verify-email"
          : "resend-verification";
  const title =
    mode === "forgot"
      ? "Şifreni mi unuttun?"
      : mode === "reset"
        ? "Yeni bir şifre belirle."
        : "E-postanı doğrula.";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "reset" && data.password !== data.confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
      setMessage(result.message);
      setSuccess(true);
      if (token) window.history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Sunucuya ulaşılamıyor. Tekrar deneyin."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recovery-shell">
      <a href="/login" className="brand">
        <span className="brand-icon">
          <Compass size={25} />
        </span>
        rota<span className="brand-dot">.</span>
      </a>
      <main className="recovery-card">
        <div className="auth-symbol">
          {success ? (
            <CheckCircle2 size={25} />
          ) : mode === "verify" ? (
            <Mail size={25} />
          ) : (
            <LockKeyhole size={25} />
          )}
        </div>
        <div className="eyebrow">HESABIN, SENİN KONTROLÜNDE</div>
        <h1>{success ? "İşlem tamamlandı." : title}</h1>
        <p>
          {success
            ? message
            : mode === "forgot"
              ? "Hesabının e-posta adresini yaz. Şifreni yenilemen için bir bağlantı gönderelim."
              : mode === "reset"
                ? "Daha önce kullanmadığın, en az 10 karakterli bir şifre seç. Diğer cihazlardaki oturumların kapatılacak."
                : verifyToken
                  ? "E-posta adresinin sana ait olduğunu onaylamak için aşağıdaki düğmeye bas."
                  : "Hesabının e-posta adresini yaz. Yeni bir doğrulama bağlantısı gönderelim."}
        </p>
        {!success && ready && (
          <form onSubmit={submit}>
            {mode === "reset" ? (
              token ? (
                <>
                  <label className="auth-label" htmlFor="new-password">
                    Yeni şifre
                    <div className="auth-input">
                      <LockKeyhole size={17} />
                      <input
                        id="new-password"
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        required
                        disabled={busy}
                      />
                    </div>
                  </label>
                  <label className="auth-label" htmlFor="confirm-password">
                    Yeni şifre (tekrar)
                    <div className="auth-input">
                      <LockKeyhole size={17} />
                      <input
                        id="confirm-password"
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        required
                        disabled={busy}
                      />
                    </div>
                  </label>
                </>
              ) : (
                <div className="auth-error" role="alert">
                  Geçerli bir sıfırlama bağlantısı yok.{" "}
                  <a href="/forgot-password">Yeni bağlantı iste.</a>
                </div>
              )
            ) : (
              !verifyToken && (
                <label className="auth-label" htmlFor="recovery-email">
                  E-posta adresin
                  <div className="auth-input">
                    <Mail size={17} />
                    <input
                      id="recovery-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      maxLength={254}
                      placeholder="ornek@eposta.com"
                      required
                      disabled={busy}
                    />
                  </div>
                </label>
              )
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            {(mode !== "reset" || token) && (
              <button className="auth-submit" disabled={busy}>
                {busy
                  ? "İşleniyor…"
                  : mode === "reset"
                    ? "Şifremi yenile"
                    : verifyToken
                      ? "E-postamı doğrula"
                      : "Bağlantı gönder"}
                <ArrowRight size={17} />
              </button>
            )}
          </form>
        )}
        <a className="back-link" href="/login">
          <ArrowLeft size={15} /> Giriş ekranına dön
        </a>
        {success && mode === "forgot" && (
          <a className="back-link" href="/forgot-password">
            Yeni bağlantı iste
          </a>
        )}
      </main>
      <footer>ROTA • Her adım yeni bir olasılık.</footer>
    </div>
  );
}
