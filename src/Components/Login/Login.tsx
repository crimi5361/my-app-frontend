import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../context/UserContext";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL_SERVER || "";

  const [email, setEmail] = useState("");
  const [mot_de_passe, setMotDePasse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setUser, setIsAuthenticated } = useContext(UserContext);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mot_de_passe }),
      });

      if (response.ok) {
        const { token, user } = await response.json();

        const userFormatted = {
          id: user.id,
          nom: user.nom,
          email: user.email,
          statut: user.statut,
          role: user.role,
          code: user.code,
          userType: user.userType,
          departementName: user.departement.nom,
          departement_id: user.departement.id, 
        };

        localStorage.setItem("token", token);
        localStorage.setItem("user_id", user.id);
        localStorage.setItem("departement_id", user.departement.id);
        localStorage.setItem("user", JSON.stringify(userFormatted));

        setUser(userFormatted);
        setIsAuthenticated(true);

        if (user.userType === "etudiant") {
          navigate("/acceuil/espace_etudiant");
        } else {
          navigate("/hub");
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Identifiants incorrects");
      }
    } catch (error) {
      console.error("Erreur de connexion :", error);
      alert("Erreur lors de la tentative de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          height: 100%;
          overflow: hidden;
        }

        .login-root {
          height: 100vh;
          width: 100vw;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #f5f3ef;
          overflow: hidden;
        }

        /* ─── LEFT PANEL ─── */
        .login-left {
          display: none;
          position: relative;
          width: 48%;
          background: #0f2044;
          overflow: hidden;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 52px 44px;
        }
        @media (min-width: 900px) { .login-left { display: flex; } }

        .left-noise {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 200px;
          pointer-events: none;
        }

        /* Decorative arcs */
        .arc {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .arc-1 { width: 520px; height: 520px; bottom: -160px; right: -160px; }
        .arc-2 { width: 340px; height: 340px; bottom: -60px; right: -60px; }
        .arc-3 { width: 180px; height: 180px; bottom: 60px; right: 60px;
                  background: rgba(99,150,255,0.06); }

        /* Floating dot grid */
        .dot-grid {
          position: absolute; top: 56px; right: 40px;
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 14px;
          opacity: 0.18;
        }
        .dot { width: 3px; height: 3px; border-radius: 50%; background: #fff; }

        .left-top { position: relative; z-index: 2; }

        .brand-badge {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 40px;
          padding: 8px 16px 8px 8px;
          backdrop-filter: blur(8px);
        }
        .brand-icon {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #4f7ef8, #a78bfa);
          display: flex; align-items: center; justify-content: center;
        }
        .brand-icon svg { width: 16px; height: 16px; fill: #fff; }
        .brand-label {
          font-size: 12px; font-weight: 500; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.7); text-transform: uppercase;
        }

        .left-middle {
          position: relative; z-index: 2;
          margin-top: auto; margin-bottom: auto;
          padding: 20px 0;
        }

        .left-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px, 3vw, 38px);
          font-weight: 700;
          line-height: 1.25;
          color: #fff;
          margin-bottom: 20px;
        }
        .left-tagline em {
          font-style: normal;
          background: linear-gradient(90deg, #7ba8ff, #c4b5fd);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .left-desc {
          font-size: 14px; line-height: 1.7;
          color: rgba(255,255,255,0.5);
          max-width: 340px;
        }

        /* Stats row */
        .stats-row {
          position: relative; z-index: 2;
          display: flex; gap: 28px;
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .stat-item {}
        .stat-num {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 700;
          color: #fff;
        }
        .stat-label {
          font-size: 11px; color: rgba(255,255,255,0.4);
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-top: 2px;
        }

        /* ─── RIGHT PANEL ─── */
        .login-right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 20px 16px;
          background: #f5f3ef;
          position: relative;
          overflow: hidden;
          height: 100%;
        }

        /* Subtle top-right gradient blob */
        .right-blob {
          position: absolute; top: -80px; right: -80px;
          width: 360px; height: 360px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,150,255,0.10) 0%, transparent 70%);
          pointer-events: none;
        }

        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 400px;
          background: #fff;
          border-radius: 22px;
          padding: 36px 36px;
          box-shadow:
            0 1px 2px rgba(0,0,0,0.04),
            0 8px 24px rgba(0,0,0,0.06),
            0 32px 64px rgba(0,0,0,0.04);
        }
        @media (max-width: 480px) {
          .card {
            padding: 28px 22px;
            border-radius: 18px;
            max-width: 100%;
          }
        }

        /* Logo area */
        .card-logo-wrap {
          display: flex; justify-content: center; margin-bottom: 20px;
        }
        .card-logo {
          height: 44px; width: auto;
          outline: 2px solid #e8e4dc;
          outline-offset: 3px;
          border-radius: 12px;
        }

        .card-heading {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 700;
          color: #0f2044;
          margin-bottom: 4px;
          text-align: center;
        }
        .card-sub {
          font-size: 12.5px; color: #8f8a80;
          text-align: center; margin-bottom: 24px;
          line-height: 1.5;
        }

        /* Divider line with label */
        .form-divider {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 18px;
        }
        .form-divider-line { flex: 1; height: 1px; background: #ece9e3; }
        .form-divider-label {
          font-size: 10px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: #b0aa9f;
          white-space: nowrap;
        }

        /* Fields */
        .field { margin-bottom: 14px; }
        .field-label {
          display: block; font-size: 11px; font-weight: 500;
          color: #4a4540; letter-spacing: 0.04em;
          text-transform: uppercase; margin-bottom: 6px;
        }
        .field-wrap { position: relative; }
        .field-icon {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          width: 15px; height: 15px;
          color: #b0aa9f;
          pointer-events: none;
          display: flex; align-items: center;
        }
        .field-icon svg { width: 15px; height: 15px; }
        .field-input {
          width: 100%;
          padding: 11px 40px 11px 38px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; color: #1a1714;
          background: #faf9f7;
          border: 1.5px solid #e8e4dc;
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .field-input::placeholder { color: #c4bfb6; }
        .field-input:focus {
          border-color: #4f7ef8;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(79,126,248,0.10);
        }
        .toggle-password {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #b0aa9f; padding: 2px;
          display: flex; align-items: center;
          transition: color 0.15s;
        }
        .toggle-password:hover { color: #4f7ef8; }
        .toggle-password svg { width: 15px; height: 15px; }

        /* Submit button */
        .btn-submit {
          margin-top: 6px;
          width: 100%;
          padding: 13px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 500;
          color: #fff;
          background: #0f2044;
          border: none; border-radius: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 16px rgba(15,32,68,0.20);
          letter-spacing: 0.02em;
          position: relative; overflow: hidden;
        }
        .btn-submit::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%);
          pointer-events: none;
        }
        .btn-submit:hover:not(:disabled) {
          background: #1a3366;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(15,32,68,0.28);
        }
        .btn-submit:active:not(:disabled) { transform: translateY(0); }
        .btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* Footer link */
        .card-footer {
          margin-top: 20px; text-align: center;
          font-size: 12px; color: #9e9890;
        }
        .card-footer a {
          color: #4f7ef8; text-decoration: none; font-weight: 500;
          transition: color 0.15s;
        }
        .card-footer a:hover { color: #2563eb; text-decoration: underline; }

        /* Fade-in card animation */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card { animation: fadeUp 0.5s cubic-bezier(.22,.68,0,1.1) both; }
      `}</style>

      <div className="login-root">
        {/* ── LEFT DECORATIVE PANEL ── */}
        <div className="login-left">
          <div className="left-noise" />
          <div className="arc arc-1" />
          <div className="arc arc-2" />
          <div className="arc arc-3" />
          <div className="dot-grid">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="dot" />
            ))}
          </div>

          {/* Brand badge */}
          <div className="left-top">
            <div className="brand-badge">
              <div className="brand-icon">
                <svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>
              </div>
              <span className="brand-label">Gestion Universitaire</span>
            </div>
          </div>

          {/* Central message */}
          <div className="left-middle">
            <div className="left-tagline">
              Bienvenue sur votre<br />
              <em>espace académique</em>
            </div>
            <p className="left-desc">
              Accédez à tous vos services universitaires — inscriptions, notes,
              emplois du temps et suivi pédagogique — depuis une seule plateforme sécurisée.
            </p>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num">7 000+</div>
              <div className="stat-label">Étudiants</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">120+</div>
              <div className="stat-label">Enseignants</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">30+</div>
              <div className="stat-label">Filières</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="login-right">
          <div className="right-blob" />

          <div className="card">
            {/* Logo */}
            <div className="card-logo-wrap">
              <img src="/logo.png" alt="Logo" className="card-logo" />
            </div>

            <h1 className="card-heading">Connexion</h1>
            <p className="card-sub">Entrez vos identifiants pour accéder à votre espace</p>

            {/* Divider */}
            <div className="form-divider">
              <div className="form-divider-line" />
              <span className="form-divider-label">Vos identifiants</span>
              <div className="form-divider-line" />
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="field">
                <label htmlFor="email" className="field-label">Adresse email</label>
                <div className="field-wrap">
                  <span className="field-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="4" width="20" height="16" rx="3"/>
                      <path d="M2 7l10 7 10-7"/>
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="field-input"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="field">
                <label htmlFor="password" className="field-label">Mot de passe</label>
                <div className="field-wrap">
                  <span className="field-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="field-input"
                    placeholder="••••••••"
                    value={mot_de_passe}
                    onChange={(e) => setMotDePasse(e.target.value)}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={isLoading} className="btn-submit">
                {isLoading ? (
                  <>
                    <div className="spinner" />
                    Connexion en cours…
                  </>
                ) : (
                  <>
                    Se connecter
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="card-footer">
              Mot de passe oublié ?{" "}
              <a href="#">Contactez l'administrateur</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;