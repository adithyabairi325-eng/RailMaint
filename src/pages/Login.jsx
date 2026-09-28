import { useState } from 'react';
import './Login.css';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'traction', label: 'Traction / OHE' },
  { value: 'signal', label: 'Signal & Telecom' },
  { value: 'passenger', label: 'Passenger' },
];

// Inline SVG icons — no external dependencies
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Meaningful Railway Simulation SVG demonstrating the PRD problem & solution:
// 1. Asset Risk Prediction (Track 1 Defect detected)
// 2. Cross-Department Maintenance Block (Engineering & Traction work zone with Stop signal)
// 3. Train Disruption Analysis & Dynamic Rerouting (Realistic Passenger Train safely rerouted with Green signal)
const RailwayIllustration = () => (
  <div className="sim-container">
    {/* Live Simulation Telemetry Header */}
    <div className="sim-header">
      <div className="sim-live-badge">
        <span className="sim-live-dot"></span>
        <span className="sim-live-text">AI DISRUPTION ANALYSIS & REROUTE ENGINE</span>
      </div>
      <div className="sim-status-pills">
        <span className="sim-pill alert">Track 1: Risk 88% (Blocked)</span>
        <span className="sim-pill success">Track 2: Clear Reroute [0s Delay]</span>
      </div>
    </div>

    <svg
      className="railway-illustration"
      viewBox="0 0 720 270"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Railway maintenance coordination simulation"
    >
      <defs>
        {/* Soft coordinate grid */}
        <pattern id="rail-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#F97316" strokeOpacity="0.06" strokeWidth="1" />
        </pattern>

        {/* Headlight beam gradient */}
        <linearGradient id="headlight-beam" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
          <stop offset="35%" stopColor="#FDE047" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
        </linearGradient>

        {/* Hazard pattern for maintenance block */}
        <pattern id="hazard-stripes" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="8" height="16" fill="#FEE2E2" />
          <rect x="8" width="8" height="16" fill="#EF4444" fillOpacity="0.25" />
        </pattern>

        {/* Locomotive metallic gradient */}
        <linearGradient id="loco-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F3F4F6" />
          <stop offset="100%" stopColor="#E5E7EB" />
        </linearGradient>

        {/* Window tint gradient */}
        <linearGradient id="coach-window" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284C7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0369A1" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <rect width="720" height="270" fill="url(#rail-grid)" />

      {/* ── OVERHEAD CATENARY (OHE) TRACTION SYSTEM ── */}
      {/* Catenary Mast 1 */}
      <line x1="60" y1="20" x2="60" y2="240" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="50" y1="35" x2="110" y2="35" stroke="#9CA3AF" strokeWidth="2" />
      <line x1="50" y1="135" x2="110" y2="135" stroke="#9CA3AF" strokeWidth="2" />
      {/* Catenary Mast 2 */}
      <line x1="360" y1="20" x2="360" y2="240" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="350" y1="35" x2="410" y2="35" stroke="#9CA3AF" strokeWidth="2" />
      <line x1="350" y1="135" x2="410" y2="135" stroke="#9CA3AF" strokeWidth="2" />
      {/* Catenary Mast 3 */}
      <line x1="660" y1="20" x2="660" y2="240" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="650" y1="35" x2="710" y2="35" stroke="#9CA3AF" strokeWidth="2" />
      <line x1="650" y1="135" x2="710" y2="135" stroke="#9CA3AF" strokeWidth="2" />

      {/* OHE Contact Wires */}
      <line x1="0" y1="42" x2="720" y2="42" stroke="#D1D5DB" strokeWidth="1.5" />
      <line x1="0" y1="142" x2="720" y2="142" stroke="#D1D5DB" strokeWidth="1.5" />

      {/* ══════════════════════════════════════════════════
          TRACK 1 (TOP) — BLOCKED MAINTENANCE SECTOR
          ══════════════════════════════════════════════════ */}
      {/* Ballast Base */}
      <rect x="0" y="68" width="720" height="24" fill="#F3F4F6" fillOpacity="0.6" />

      {/* Sleepers (Ties) */}
      {Array.from({ length: 36 }).map((_, i) => (
        <line key={`s1-${i}`} x1={i * 20 + 8} y1="68" x2={i * 20 + 8} y2="92"
          stroke="#D1D5DB" strokeWidth="3" />
      ))}

      {/* Steel Rails */}
      <line x1="0" y1="73" x2="720" y2="73" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="0" y1="87" x2="720" y2="87" stroke="#9CA3AF" strokeWidth="2.5" />

      {/* Turnout Switch Track (Diverting from Track 1 to Track 2) */}
      <path d="M 90,87 C 140,87 170,187 230,187" fill="none" stroke="#F97316" strokeWidth="2.5" strokeDasharray="5 3" />
      <path d="M 104,73 C 150,73 180,173 240,173" fill="none" stroke="#F97316" strokeWidth="2.5" strokeDasharray="5 3" />

      {/* RED SIGNAL POST ON TRACK 1 (STOP - WORK ZONE) */}
      <g transform="translate(195, 45)">
        <rect x="0" y="0" width="4" height="40" fill="#4B5563" />
        <rect x="-6" y="-4" width="16" height="26" rx="4" fill="#1F2937" />
        {/* Red glowing lamp */}
        <circle cx="2" cy="4" r="5" fill="#EF4444">
          <animate attributeName="fillOpacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="2" cy="14" r="4" fill="#374151" />
        <text x="14" y="8" fontSize="9" fontWeight="700" fill="#EF4444" fontFamily="sans-serif">STOP: BLOCKED</text>
      </g>

      {/* WORK IN PROGRESS / HAZARD ZONE */}
      <rect x="270" y="66" width="340" height="28" rx="6" fill="url(#hazard-stripes)" stroke="#EF4444" strokeWidth="1.5" />

      {/* AI Risk Detection Pulse (Asset Failure Point) */}
      <g transform="translate(370, 80)">
        <circle cx="0" cy="0" r="14" fill="#EF4444" fillOpacity="0.15">
          <animate attributeName="r" values="8;24;8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="fillOpacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="0" r="6" fill="#EF4444" />
        {/* Crack icon */}
        <path d="M-3,-3 L0,0 L-2,3 L2,4" stroke="#FFF" strokeWidth="1.5" fill="none" />
      </g>

      {/* Asset Risk Card */}
      <g transform="translate(310, 22)">
        <rect width="180" height="26" rx="6" fill="#FEF2F2" stroke="#EF4444" strokeWidth="1.2" />
        <circle cx="12" cy="13" r="4" fill="#EF4444" />
        <text x="24" y="17" fontSize="10.5" fontWeight="700" fill="#991B1B" fontFamily="sans-serif">
          DEFECT RISK: 88% CRITICAL
        </text>
      </g>

      {/* Maintenance Vehicle & Crew on Track 1 */}
      <g transform="translate(500, 56)">
        {/* Maintenance Rail Truck Body */}
        <rect x="0" y="6" width="85" height="22" rx="4" fill="#F59E0B" />
        <rect x="6" y="9" width="18" height="12" rx="2" fill="#FEF3C7" />
        <rect x="28" y="9" width="18" height="12" rx="2" fill="#FEF3C7" />
        {/* Flashing Amber Beacon */}
        <circle cx="75" cy="4" r="4" fill="#F59E0B">
          <animate attributeName="fill" values="#F59E0B;#EF4444;#F59E0B" dur="0.8s" repeatCount="indefinite" />
        </circle>
        {/* Crane Arm */}
        <line x1="55" y1="6" x2="40" y2="-8" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
        <line x1="40" y1="-8" x2="20" y2="4" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
        {/* Wheels */}
        <circle cx="16" cy="30" r="5" fill="#374151" />
        <circle cx="70" cy="30" r="5" fill="#374151" />
        {/* Dept Badge */}
        <rect x="0" y="-22" width="112" height="18" rx="4" fill="#FFF7ED" stroke="#F97316" strokeWidth="1" />
        <text x="56" y="-10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#C2410C" fontFamily="sans-serif">
          ENGINEERING & OHE CREW
        </text>
      </g>


      {/* ══════════════════════════════════════════════════
          TRACK 2 (BOTTOM) — DYNAMIC RE-ROUTE CLEAR LINE
          ══════════════════════════════════════════════════ */}
      {/* Ballast Base */}
      <rect x="0" y="168" width="720" height="24" fill="#F3F4F6" fillOpacity="0.6" />

      {/* Sleepers */}
      {Array.from({ length: 36 }).map((_, i) => (
        <line key={`s2-${i}`} x1={i * 20 + 8} y1="168" x2={i * 20 + 8} y2="192"
          stroke="#D1D5DB" strokeWidth="3" />
      ))}

      {/* Steel Rails */}
      <line x1="0" y1="173" x2="720" y2="173" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="0" y1="187" x2="720" y2="187" stroke="#9CA3AF" strokeWidth="2.5" />

      {/* GREEN SIGNAL POST (PROCEED ON CLEAR REROUTE) */}
      <g transform="translate(145, 142)">
        <rect x="0" y="0" width="4" height="42" fill="#4B5563" />
        <rect x="-6" y="-4" width="16" height="26" rx="4" fill="#1F2937" />
        <circle cx="2" cy="4" r="4" fill="#374151" />
        {/* Green glowing lamp */}
        <circle cx="2" cy="14" r="5" fill="#10B981">
          <animate attributeName="fillOpacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <text x="14" y="18" fontSize="9" fontWeight="700" fill="#059669" fontFamily="sans-serif">PROCEED (REROUTED)</text>
      </g>

      {/* ══════════════════════════════════════════════════
          REALISTIC STREAMLINED PASSENGER TRAIN (MOVING)
          ══════════════════════════════════════════════════ */}
      <g className="realistic-train-group" transform="translate(230, 138)">
        {/* Headlight illumination beam projecting forward onto the track */}
        <polygon points="340,36 490,10 490,62" fill="url(#headlight-beam)" />

        {/* ── PASSENGER COACH 2 (Trailing) ── */}
        <g transform="translate(0, 8)">
          {/* Coach Body */}
          <rect x="0" y="0" width="105" height="34" rx="4" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
          {/* Orange Livery Stripe */}
          <rect x="0" y="22" width="105" height="5" fill="#F97316" />
          <rect x="0" y="28" width="105" height="2" fill="#1E293B" />
          {/* Panoramic Windows */}
          <rect x="12" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="34" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="56" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="78" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          {/* Bogie 1 (Left Wheels) */}
          <rect x="8" y="34" width="24" height="4" fill="#334155" />
          <circle cx="12" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="12" cy="40" r="2" fill="#CBD5E1" />
          <circle cx="28" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="28" cy="40" r="2" fill="#CBD5E1" />
          {/* Bogie 2 (Right Wheels) */}
          <rect x="72" y="34" width="24" height="4" fill="#334155" />
          <circle cx="76" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="76" cy="40" r="2" fill="#CBD5E1" />
          <circle cx="92" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="92" cy="40" r="2" fill="#CBD5E1" />
        </g>

        {/* Flexible Gangway 1 */}
        <rect x="105" y="14" width="6" height="24" rx="1" fill="#475569" />

        {/* ── PASSENGER COACH 1 ── */}
        <g transform="translate(111, 8)">
          <rect x="0" y="0" width="105" height="34" rx="4" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="0" y="22" width="105" height="5" fill="#F97316" />
          <rect x="0" y="28" width="105" height="2" fill="#1E293B" />
          <rect x="12" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="34" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="56" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          <rect x="78" y="7" width="16" height="11" rx="2" fill="url(#coach-window)" />
          {/* Bogie 1 */}
          <rect x="8" y="34" width="24" height="4" fill="#334155" />
          <circle cx="12" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="12" cy="40" r="2" fill="#CBD5E1" />
          <circle cx="28" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="28" cy="40" r="2" fill="#CBD5E1" />
          {/* Bogie 2 */}
          <rect x="72" y="34" width="24" height="4" fill="#334155" />
          <circle cx="76" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="76" cy="40" r="2" fill="#CBD5E1" />
          <circle cx="92" cy="40" r="5.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="92" cy="40" r="2" fill="#CBD5E1" />
        </g>

        {/* Flexible Gangway 2 */}
        <rect x="216" y="14" width="6" height="24" rx="1" fill="#475569" />

        {/* ── AERODYNAMIC LOCOMOTIVE (Engine) ── */}
        <g transform="translate(222, 6)">
          {/* Roof Pantograph (Reaching to OHE wire) */}
          <path d="M 35,2 L 48,-14 L 62,-14 L 75,2" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
          <line x1="44" y1="-14" x2="66" y2="-14" stroke="#DC2626" strokeWidth="2.5" />

          {/* Aerodynamic Body Shell */}
          <path d="M 0,2 
                   L 80,2 
                   Q 115,3 126,18 
                   L 132,32 
                   L 132,36 
                   L 0,36 Z"
            fill="url(#loco-body)" stroke="#94A3B8" strokeWidth="1.2" />

          {/* Racing Livery Stripe */}
          <path d="M 0,24 L 95,24 Q 115,25 128,34 L 132,36 L 0,36 Z" fill="#F97316" />
          <rect x="0" y="34" width="130" height="3" fill="#0F172A" />

          {/* Driver Cockpit Windshield */}
          <path d="M 88,7 L 110,7 Q 120,16 114,20 L 88,20 Z" fill="#0284C7" stroke="#0F172A" strokeWidth="1" />

          {/* Side Engine Louvers */}
          <line x1="16" y1="10" x2="38" y2="10" stroke="#CBD5E1" strokeWidth="2" />
          <line x1="16" y1="14" x2="38" y2="14" stroke="#CBD5E1" strokeWidth="2" />
          <line x1="16" y1="18" x2="38" y2="18" stroke="#CBD5E1" strokeWidth="2" />

          {/* Dual LED Headlights */}
          <circle cx="128" cy="27" r="3" fill="#FEF08A" />
          <circle cx="130" cy="31" r="3" fill="#FEF08A" />

          {/* Bogie 1 (Left) */}
          <rect x="12" y="36" width="28" height="5" fill="#334155" />
          <circle cx="16" cy="42" r="5.5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="16" cy="42" r="2" fill="#F97316" />
          <circle cx="34" cy="42" r="5.5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="34" cy="42" r="2" fill="#F97316" />

          {/* Bogie 2 (Right) */}
          <rect x="80" y="36" width="28" height="5" fill="#334155" />
          <circle cx="84" cy="42" r="5.5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="84" cy="42" r="2" fill="#F97316" />
          <circle cx="102" cy="42" r="5.5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
          <circle cx="102" cy="42" r="2" fill="#F97316" />

          {/* Cowcatcher / Pilot Grill */}
          <polygon points="126,38 135,43 124,43" fill="#475569" />
        </g>

        {/* Floating Train Status Label */}
        <g transform="translate(110, -18)">
          <rect width="180" height="20" rx="4" fill="#059669" />
          <text x="90" y="13" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF" fontFamily="sans-serif">
            PASSENGER EXP #12408 · ON TIME
          </text>
        </g>
      </g>
    </svg>

    {/* Simulation Explanation Footer */}
    <div className="sim-footer">
      <div className="sim-footer-item">
        <span className="sim-footer-dot red"></span>
        <span><strong>Track 1:</strong> AI Failure Risk Triggered Maintenance Block</span>
      </div>
      <div className="sim-footer-item">
        <span className="sim-footer-dot green"></span>
        <span><strong>Track 2:</strong> Intelligent Real-Time Replanning (Zero Delay)</span>
      </div>
    </div>
  </div>
);

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (auth && email && password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        console.log("Firebase login successful");
      }
    } catch (error) {
      console.warn("Firebase sign-in note:", error.message);
    }

    // Navigate to the selected role dashboard
    if (onLoginSuccess) {
      onLoginSuccess(role);
    }
  };

  return (
    <div className="login-page">
      {/* ── TOP LEFT CORNER BRANDING ── */}
      <header className="login-topbar">
        <div className="login-brand">
          <div className="login-brand-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="7" fill="#F97316" />
              <path d="M6 20 L14 8 L22 20" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="9" y1="16" x2="19" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="login-brand-name">Railway Maintenance AI</span>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="login-main">
        {/* ── LEFT PANEL (Prominent & Fills Space) ── */}
        <div className="login-left">
          <div className="login-left-content">
            {/* Tagline */}
            <div className="login-tagline">
              <h1 className="login-tagline-headline">
                Smarter Maintenance.<br />Safer Railways.
              </h1>
              <p className="login-tagline-body">
                Predict, coordinate and optimize railway maintenance operations
                with intelligent scheduling, asset-risk scoring, and train disruption analysis.
              </p>
            </div>

            {/* Meaningful Simulation Display */}
            <div className="login-illustration-wrap">
              <RailwayIllustration />
            </div>

            {/* PRD Capabilities / Value Proposition Cards (Fills vertical height cleanly) */}
            <div className="login-feature-grid">
              <div className="feature-card">
                <div className="feature-card-icon">⚡</div>
                <div className="feature-card-info">
                  <span className="feature-title">Asset-Risk Scoring</span>
                  <span className="feature-desc">ML failure prediction for track & OHE</span>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-card-icon">🛠️</div>
                <div className="feature-card-info">
                  <span className="feature-title">Block Optimization</span>
                  <span className="feature-desc">Cross-department sync across 5 teams</span>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-card-icon">🚆</div>
                <div className="feature-card-info">
                  <span className="feature-title">Disruption Analysis</span>
                  <span className="feature-desc">Automated dynamic rerouting & zero delay</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-logo">
              <div className="login-logo-ring" aria-hidden="true">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="44" height="44" rx="14" fill="#FFF7ED" />
                  <path d="M10 32 L22 12 L34 32" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <line x1="15" y1="26" x2="29" y2="26" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <h2 className="login-title">Welcome Back</h2>
            <p className="login-subtitle">Sign in to continue to Railway Maintenance AI</p>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email / Employee ID
                </label>
                <input
                  id="login-email"
                  type="text"
                  className="form-input"
                  placeholder="Enter your email or employee ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <div className="password-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-role">
                  Role
                </label>
                <div className="select-wrapper">
                  <select
                    id="login-role"
                    className="role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <span className="select-chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              <button type="submit" className="login-button">
                Login
              </button>

              <p className="login-hint">
                Select your role to access the corresponding dashboard.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
