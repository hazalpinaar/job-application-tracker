"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  Sparkles,
} from "lucide-react";
export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const register = mode === "register";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "İşlem tamamlanamadı.");
      if (data.verificationRequired) {
        setMode("login");
        setMessage(data.message);
        setBusy(false);
        return;
      }
      window.location.assign("/");
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin."
          : (e as Error).message,
      );
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <a href="/login" className="brand auth-brand">
          <span className="brand-icon">
            <Compass size={26} />
          </span>
          rota<span className="brand-dot">.</span>
        </a>
        <div className="story-content">
          <div className="story-pill">
            <Sparkles size={14} /> SIRADAKİ BÜYÜK ADIMIN İÇİN
          </div>
          <h1>
            Hayalindeki işe
            <br /> giden yol,
            <br /> <em>senin rotan.</em>
          </h1>
          <p>
            Başvuruların, görüşmelerin ve yeni başlangıçların.
            <br />
            Hepsini tek bir yerde, kendi hızında yönet.
          </p>
          <div className="story-preview">
            <div className="preview-top">
              <span className="preview-company">R</span>
              <div>
                <strong>Bir sonraki fırsatın</strong>
                <small>Kariyer yolculuğun</small>
              </div>
              <ArrowUpRight size={20} />
            </div>
            <div className="preview-track">
              <span className="track-done">
                <Check size={12} />
              </span>
              <i />
              <span className="track-done">
                <Check size={12} />
              </span>
              <i />
              <span className="track-current" />
            </div>
            <div className="track-labels">
              <span>Başvuru</span>
              <span>Görüşme</span>
              <span>Yeni başlangıç</span>
            </div>
          </div>
          <div className="story-benefits">
            <span>
              <Check size={15} /> Daha az karmaşa
            </span>
            <span>
              <Check size={15} /> Daha fazla odak
            </span>
          </div>
        </div>
        <div className="story-bottom">
          <span>HER ADIM BİR OLASILIK.</span>
          <span>↗</span>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>
      <section className="auth-form-side">
        <div className="auth-top-note">
          {register ? "Zaten bir hesabın var mı?" : "Rota’da yeni misin?"}
          <button
            disabled={busy}
            onClick={() => {
              setMode(register ? "login" : "register");
              setError("");
            }}
          >
            {register ? "Giriş yap" : "Hesap oluştur"} <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-symbol">
            <Compass size={25} />
          </div>
          <div className="eyebrow">KARİYERİN İÇİN YER AÇ</div>
          <h2>{register ? "Kendi rotanı oluştur." : "Kaldığın yerden devam et."}</h2>
          <p className="auth-intro">
            {register
              ? "Hesabını oluştur, yeni fırsatlara ilk adımını at."
              : "Tekrar hoş geldin! Fırsatların seni bekliyor."}
          </p>
          <div className="auth-switch" aria-label="Hesap işlemi">
            <button
              disabled={busy}
              className={!register ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Giriş yap
            </button>
            <button
              disabled={busy}
              className={register ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Hesap oluştur
            </button>
          </div>
          <form onSubmit={submit} key={mode}>
            {register && (
              <label className="auth-label" htmlFor="name">
                Adın soyadın
                <div className="auth-input">
                  <UserRound size={18} />
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Adın Soyadın"
                    minLength={2}
                    maxLength={80}
                    required
                    disabled={busy}
                  />
                </div>
              </label>
            )}
            <label className="auth-label" htmlFor="email">
              E-posta adresin
              <div className="auth-input">
                <Mail size={18} />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="ornek@eposta.com"
                  maxLength={254}
                  required
                  disabled={busy}
                />
              </div>
            </label>
            <label className="auth-label" htmlFor="password">
              Şifren
              <div className="auth-input">
                <LockKeyhole size={18} />
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={register ? "En az 10 karakter" : "Şifreni gir"}
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {register && (
              <p className="password-hint">
                Güçlü bir şifre için en az 10 karakter kullan.
              </p>
            )}
            {!register && (
              <div className="auth-help">
                <a href="/forgot-password">Şifremi unuttum</a>
                <a href="/verify-email">E-postamı doğrula</a>
              </div>
            )}
            {message && (
              <div className="auth-success" role="status">
                {message}
              </div>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button className="auth-submit" disabled={busy} type="submit">
              {busy ? "Birazdan hazır…" : register ? "Hesabımı oluştur" : "Giriş yap"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-reassurance">
            <LockKeyhole size={13} />
            <span>Kişisel alanın. Başvurularını yalnızca sen görürsün.</span>
          </div>
        </div>
        <div className="auth-footer">
          <span>© {new Date().getFullYear()} Rota</span>
          <span>Bir sonraki adım, senin elinde.</span>
        </div>
      </section>
    </div>
  );
}
