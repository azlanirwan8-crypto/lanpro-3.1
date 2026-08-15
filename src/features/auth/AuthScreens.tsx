import { safeLocalStorage } from "../../lib/safeStorage";
import React, { useState, useEffect, useMemo } from "react";
import { LogIn, Lock, Activity, Users, FileText, Bot, ArrowRight, UserPlus, Fingerprint, RefreshCcw, Eye, EyeOff, Building, MapPin, Building2, User, Phone, Briefcase, Mail, AlertCircle, X, ShieldCheck } from "lucide-react";
import { Button, Input, VelzonFloatingParticles, cn } from "../../components/ui/CoreUI";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, setAuthToken } from "../../lib/api";
import { registrationSchema, evaluatePasswordStrength } from "../../lib/registrationSchema";
import { toast } from "sonner";
import { VelzonSuccessIcon } from "../../components/AuthToastContainer";

export const AuthHeroPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#364574] via-primary to-[#212529] items-center justify-center p-8 xl:p-12 select-none min-h-screen z-10 overflow-hidden">
    {/* Floating White Particles Effect */}
    <VelzonFloatingParticles />

    {/* Subtle Ambient Mesh Gradient */}
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/30 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] bg-cyan-400/20 rounded-full blur-[140px]" />
      <div className="absolute top-[35%] left-[15%] w-[45%] h-[45%] bg-blue-600/20 rounded-full blur-[130px]" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
    </div>

    {/* Organic S-Curve Wave Divider Overlay */}
    <svg
      className="absolute top-0 -right-[79px] xl:-right-[119px] h-full w-[80px] xl:w-[120px] pointer-events-none z-20 drop-shadow-[8px_0_16px_rgba(0,0,0,0.3)]"
      viewBox="0 0 120 1000"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wave-glow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
        </linearGradient>
        <filter id="glow-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Solid S-Curve Fill matching Velzon #405189 */}
      <path
        d="M 0 0 C 85 200, 115 380, 55 520 C -5 660, 80 840, 0 1000 L 0 0 Z"
        fill="#405189"
      />

      {/* Glowing Border Accent along the S-Curve Edge */}
      <path
        d="M 0 0 C 85 200, 115 380, 55 520 C -5 660, 80 840, 0 1000"
        fill="none"
        stroke="url(#wave-glow)"
        strokeWidth="3"
        filter="url(#glow-shadow)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>

    <div className="relative z-10 max-w-lg w-full text-center pr-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-6xl font-medium text-white leading-[0.9] tracking-tighter drop-shadow-md">
          LAN <span className="text-amber-400">PRO</span>
        </h1>
        <p className="text-xs font-medium text-slate-200 mt-3 tracking-widest uppercase">
          Project Management Platform
        </p>
      </motion.div>
    </div>
  </div>
);

export const AuthWatermarkPattern = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-10 select-none">
    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900" preserveAspectRatio="none">
      <g stroke="#405189" strokeWidth="1.2" fill="none">
        {/* Kanban Wireframe Columns */}
        <rect x="60" y="80" width="200" height="340" rx="14" strokeDasharray="6 6" />
        <rect x="290" y="80" width="200" height="440" rx="14" />
        <rect x="520" y="80" width="200" height="300" rx="14" strokeDasharray="6 6" />
        
        {/* Kanban Task Cards */}
        <rect x="80" y="110" width="160" height="75" rx="8" fill="#405189" fillOpacity="0.03" />
        <rect x="80" y="200" width="160" height="95" rx="8" fill="#405189" fillOpacity="0.03" />
        
        <rect x="310" y="110" width="160" height="85" rx="8" fill="#405189" fillOpacity="0.05" />
        <rect x="310" y="215" width="160" height="120" rx="8" fill="#405189" fillOpacity="0.05" />
        <rect x="310" y="350" width="160" height="85" rx="8" fill="#405189" fillOpacity="0.05" />

        <rect x="540" y="110" width="160" height="110" rx="8" fill="#405189" fillOpacity="0.03" />
        <rect x="540" y="240" width="160" height="75" rx="8" fill="#405189" fillOpacity="0.03" />

        {/* Sprint Velocity & Network Connection Curves */}
        <path d="M 80 620 Q 240 520 400 640 T 720 540 T 820 480" strokeWidth="2.5" stroke="#405189" />
        <path d="M 80 700 L 260 580 L 440 660 L 620 520 L 800 600" strokeWidth="1.5" strokeDasharray="5 5" stroke="#3577f1" />
        
        {/* Nodes */}
        <circle cx="80" cy="620" r="6" fill="#405189" />
        <circle cx="400" cy="640" r="8" fill="#405189" />
        <circle cx="720" cy="540" r="6" fill="#405189" />
        <circle cx="820" cy="480" r="7" fill="#405189" />

        <circle cx="80" cy="700" r="5" fill="#3577f1" />
        <circle cx="260" cy="580" r="5" fill="#3577f1" />
        <circle cx="440" cy="660" r="5" fill="#3577f1" />
        <circle cx="620" cy="520" r="5" fill="#3577f1" />
        <circle cx="800" cy="600" r="5" fill="#3577f1" />
      </g>
    </svg>
  </div>
);

export const RegisterScreen = ({
  onRegister,
  onBackToLogin,
}: {
  onRegister: (u: string, p: string, n: string, e: string) => Promise<any>;
  onBackToLogin: () => void;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    username?: string;
    password?: string;
  }>({});

  // Success Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Evaluate password strength
  const passStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const handleNameChange = (val: string) => {
    if (val.length > 25) return;
    setName(val);
    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Allow only alphabetic letters
    const filteredVal = rawVal.replace(/[^a-zA-Z]/g, "").slice(0, 10);
    
    if (rawVal !== filteredVal) {
      setFieldErrors(prev => ({ ...prev, username: "Username hanya boleh berupa huruf" }));
    } else if (filteredVal.length > 10) {
      setFieldErrors(prev => ({ ...prev, username: "Username maksimal 10 karakter" }));
    } else {
      setFieldErrors(prev => ({ ...prev, username: undefined }));
    }
    setUsername(filteredVal);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side Zod validation
    const result = registrationSchema.safeParse({ name, email, username, password });
    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0] as string] = err.message;
        }
      });
      setFieldErrors(formattedErrors);
      return;
    }

    if (isRegistering) return;
    setIsRegistering(true);
    try {
      const res = await onRegister(username, password, name, email);
      if (res && res.success) {
        setShowSuccessModal(true);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSuccessModalConfirm = () => {
    setShowSuccessModal(false);
    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setFieldErrors({});
    onBackToLogin();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100/90 p-8 sm:p-10 relative z-10 font-sans mx-auto"
    >
      {/* Velzon Header */}
      <div className="text-center space-y-1.5 mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white shadow-md shadow-primary/25 mb-1">
          <UserPlus className="w-6 h-6 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          Create New Account
        </h2>
        <p className="text-xs font-medium text-slate-500">
          Join LanPro to manage projects and workflows
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleRegisterSubmit}>
        {/* FULL NAME INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide block">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            maxLength={25}
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="John Doe"
            className={cn(
              "w-full px-4 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
              fieldErrors.name ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
            )}
          />
          {fieldErrors.name && (
            <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.name}</span>
            </p>
          )}
        </div>

        {/* EMAIL ADDRESS INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide block">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="john.doe@company.com"
            className={cn(
              "w-full px-4 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
              fieldErrors.email ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
            )}
          />
          {fieldErrors.email && (
            <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.email}</span>
            </p>
          )}
        </div>

        {/* USERNAME INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide block">
            Username <span className="text-rose-500">*</span> <span className="text-xs sm:text-[11px] text-slate-400 font-normal">(Huruf saja, maks 10)</span>
          </label>
          <input
            type="text"
            maxLength={10}
            required
            value={username}
            onChange={handleUsernameChange}
            placeholder="johndoe"
            className={cn(
              "w-full px-4 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
              fieldErrors.username ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
            )}
          />
          {fieldErrors.username && (
            <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.username}</span>
            </p>
          )}
        </div>

        {/* PASSWORD INPUT & STRENGTH METER */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide block">
            Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="••••••••"
              className={cn(
                "w-full pl-4 pr-11 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
                fieldErrors.password ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-primary focus:outline-none cursor-pointer transition-colors"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Strength Indicator Bar */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
              <div className="flex items-center justify-between text-xs sm:text-[11px] font-medium">
                <span className="text-slate-600">Password Strength:</span>
                <span className={passStrength.color}>{passStrength.label}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-300 rounded-full", passStrength.barColor)}
                  style={{ width: `${passStrength.percentage}%` }}
                />
              </div>

              {/* Criteria Checklist */}
              <div className="grid grid-cols-2 gap-1 text-xs sm:text-[10px] font-medium mt-1.5 text-slate-500">
                <div className={cn("flex items-center gap-1", passStrength.criteria.minLength ? "text-emerald-600 font-medium" : "text-slate-400")}>
                  <span>{passStrength.criteria.minLength ? "[✓]" : "[ ]"}</span> Min 8 Karakter
                </div>
                <div className={cn("flex items-center gap-1", passStrength.criteria.upper ? "text-emerald-600 font-medium" : "text-slate-400")}>
                  <span>{passStrength.criteria.upper ? "[✓]" : "[ ]"}</span> Huruf Besar (A-Z)
                </div>
                <div className={cn("flex items-center gap-1", passStrength.criteria.digit ? "text-emerald-600 font-medium" : "text-slate-400")}>
                  <span>{passStrength.criteria.digit ? "[✓]" : "[ ]"}</span> Angka (0-9)
                </div>
                <div className={cn("flex items-center gap-1", passStrength.criteria.special ? "text-emerald-600 font-medium" : "text-slate-400")}>
                  <span>{passStrength.criteria.special ? "[✓]" : "[ ]"}</span> Simbol (@$!%*?&)
                </div>
              </div>
            </div>
          )}

          {fieldErrors.password && (
            <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.password}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isRegistering}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold uppercase tracking-wider text-xs hover:bg-[#364574] transition-all shadow-md shadow-primary/20 active:scale-[0.99] mt-3 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isRegistering ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Sign Up</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs font-medium text-slate-500 pt-5 mt-4 border-t border-slate-100">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-primary font-semibold hover:text-[#364574] transition-colors ml-1 cursor-pointer hover:underline"
        >
          Sign In
        </button>
      </p>

      {/* REGISTRATION SUCCESS MODAL (VELZON SWEETALERT STYLE) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 font-sans">
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden space-y-4"
          >
            <button 
              onClick={handleSuccessModalConfirm}
              className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-md"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Velzon Party Cone Animated Icon */}
            <VelzonSuccessIcon />

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                Registrasi berhasil!
              </h3>
              <p className="text-sm text-slate-500 font-normal leading-relaxed px-2">
                Silakan tunggu Administrator menyetujui akun Anda sebelum bisa Login.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSuccessModalConfirm}
              className="px-8 py-2.5 bg-primary hover:bg-[#364574] text-white rounded-md text-sm font-semibold shadow-md transition-all cursor-pointer min-w-[120px] mt-2"
            >
              Ke Halaman Login
            </motion.button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export const LoginSkeletonState = ({ loadingText }: { loadingText?: string }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100/90 p-8 sm:p-10 relative z-10 font-sans mx-auto text-center space-y-6"
    >
      {/* Velzon Center Animated Logo Icon */}
      <div className="relative inline-flex items-center justify-center pt-2">
        <motion.div 
          className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-soft-lg shadow-primary/30 relative z-10"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <span className="text-xl font-extrabold tracking-wider text-amber-400">LP</span>
        </motion.div>
        {/* Pulsing Outer Ring */}
        <motion.div 
          className="absolute inset-0 rounded-2xl bg-primary/25"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>

      {/* Loading Status & Message */}
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-slate-800 tracking-tight flex items-center justify-center gap-1.5">
          <span>{loadingText || "Authenticating..."}</span>
          <span className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
          </span>
        </h3>
        <p className="text-xs text-slate-400 font-medium">
          Memverifikasi sesi workspace Anda...
        </p>
      </div>

      {/* Velzon Smooth Gradient Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative">
        <motion.div 
          className="bg-gradient-to-r from-amber-400 via-info to-cyan-400 h-full rounded-full"
          animate={{ width: ["10%", "90%", "35%", "95%"] }}
          transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
};

export const LoginScreen = ({
  onLogin,
  onRegisterClick,
  loading,
  loadingText = "Authenticating...",
}: {
  onLogin: (u: string, p: string, remember: boolean) => void;
  onRegisterClick: () => void;
  loading?: boolean;
  loadingText?: string;
}) => {
  const [username, setUsername] = useState(() => {
    try {
      return safeLocalStorage.getItem("savedUsername") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return safeLocalStorage.getItem("rememberUser") === "true";
    } catch {
      return false;
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  useEffect(() => {
    try {
      if (rememberMe) {
        safeLocalStorage.setItem("savedUsername", username);
        safeLocalStorage.setItem("rememberUser", "true");
      } else {
        safeLocalStorage.removeItem("savedUsername");
        safeLocalStorage.setItem("rememberUser", "false");
      }
    } catch {}
  }, [username, rememberMe]);

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (fieldErrors.username) {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      errors.username = "Username wajib diisi";
    }
    if (!password.trim()) {
      errors.password = "Password wajib diisi";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Gagal Masuk", {
        description: "Username dan Password wajib diisi terlebih dahulu.",
      });
      return;
    }

    setFieldErrors({});
    onLogin(username.trim(), password.trim(), rememberMe);
  };

  return (
    <div className="w-full max-w-md mx-auto relative">
      <AnimatePresence mode="wait">
        {loading ? (
          <div key="login-skeleton" className="w-full">
            <LoginSkeletonState loadingText={loadingText} />
          </div>
        ) : (
          <motion.div 
            key="login-form-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100/90 p-8 sm:p-10 relative z-10 font-sans mx-auto"
          >
            {/* Velzon Card Header */}
            <div className="text-center space-y-1.5 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white shadow-md shadow-primary/25 mb-1">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Sign in to continue to LanPro Workspace
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleLoginSubmit}
            >
              {/* USERNAME FIELD */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 tracking-wide block">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
                    fieldErrors.username ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
                  )}
                />
                {fieldErrors.username && (
                  <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.username}</span>
                  </p>
                )}
              </div>

              {/* PASSWORD FIELD */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 tracking-wide block">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className={cn(
                      "w-full pl-4 pr-11 py-3 bg-slate-50 border rounded-lg focus:bg-white focus:ring-2 transition-all outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400",
                      fieldErrors.password ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-primary focus:outline-none cursor-pointer transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs sm:text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}
              </div>

              {/* REMEMBER ME */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600">
                    Remember Me
                  </span>
                </label>
              </div>

              {/* SIGN IN BUTTON */}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold uppercase tracking-wider text-xs hover:bg-[#364574] transition-all shadow-md shadow-primary/20 active:scale-[0.99] mt-3 flex items-center justify-center gap-2.5 group cursor-pointer disabled:bg-primary/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <p className="text-center text-xs font-medium text-slate-500 pt-5 mt-4 border-t border-slate-100">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={onRegisterClick}
                className="text-primary font-semibold hover:text-[#364574] transition-colors ml-1 cursor-pointer hover:underline"
              >
                Sign Up
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};



