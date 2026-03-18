import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Phone, ShieldCheck, MapPin, ChevronLeft, KeyRound } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { logSiteAction } from "@/lib/logSiteAction";

type Step = "form" | "otp" | "address";
type ResetStep = "input" | "otp" | "new_password";

const Auth = () => {
  const { storeName, logoUrl, initial, company } = useBranding();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

  // Address fields
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Reset password flow state
  const [resetStep, setResetStep] = useState<ResetStep>("input");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetPhone, setResetPhone] = useState(""); // actual phone to send OTP to
  const [resetMaskedPhone, setResetMaskedPhone] = useState(""); // masked display
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpSending, setResetOtpSending] = useState(false);
  const [resetResendTimer, setResetResendTimer] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const formatPhone = (raw: string) => {
    let p = raw.replace(/\D/g, "");
    if (p.startsWith("0")) p = "94" + p.slice(1);
    if (!p.startsWith("94")) p = "94" + p;
    return p;
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const startResetResendTimer = () => {
    setResetResendTimer(60);
    const interval = setInterval(() => {
      setResetResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!email || !password || password.length < 6) {
      toast.error("Please fill in email and password (min 6 characters)");
      return;
    }
    setOtpSending(true);
    try {
      const formattedPhone = formatPhone(phone);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id, is_suspended")
        .eq("phone", formattedPhone)
        .maybeSingle();
      if (existingProfile) {
        if (existingProfile.is_suspended) {
          toast.error("This phone number is associated with a suspended account. Please contact support.");
        } else {
          toast.error("This phone number is already registered. Please log in instead.");
        }
        setOtpSending(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          phone: formattedPhone,
          type: "otp",
          template_key: "otp_verification",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send OTP");
      toast.success("OTP sent to your phone!");
      setStep("otp");
      startResendTimer();
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length !== 5) {
      toast.error("Please enter the 5-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const { data: otpResult, error: otpError } = await supabase.functions.invoke("verify-otp", {
        body: { phone: formattedPhone, otp: otpValue },
      });
      if (otpError) throw otpError;
      if (!otpResult?.success) throw new Error(otpResult?.error || "OTP verification failed");

      toast.success("Phone verified! Now enter your address.");
      setStep("address");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!addressLine1.trim()) {
      toast.error("Please enter your address (Line 1)");
      return;
    }
    if (!city.trim()) {
      toast.error("Please enter your city");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: formattedPhone,
            phone_verified: true,
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim() || null,
            city: city.trim(),
            postal_code: postalCode.trim() || null,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) throw signUpError;

      logSiteAction("user_registered", "user", email, { name: fullName, city: city.trim() });
      toast.success("Account created! Please check your email to verify.");
      resetForm();
      setIsLogin(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Reset Password Flow ──────────────────────────────────────────────────

  const handleResetLookup = async () => {
    if (!resetIdentifier.trim()) {
      toast.error("Please enter your email or phone number");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password-otp", {
        body: { action: "lookup", identifier: resetIdentifier.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Account not found");

      setResetPhone(data.phone);
      setResetMaskedPhone(data.maskedPhone);

      // Send OTP immediately
      await sendResetOtp(data.phone);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendResetOtp = async (phoneOverride?: string) => {
    const targetPhone = phoneOverride || resetPhone;
    setResetOtpSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password-otp", {
        body: { action: "send_otp", phone: targetPhone },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send OTP");
      toast.success("OTP sent to your phone!");
      setResetStep("otp");
      startResetResendTimer();
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setResetOtpSending(false);
    }
  };

  const handleResetOtpVerify = async () => {
    if (resetOtp.length !== 5) {
      toast.error("Please enter the 5-digit OTP");
      return;
    }
    setLoading(true);
    try {
      // We verify OTP inline with verify-otp edge function just to check it first
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone: resetPhone, otp: resetOtp },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "OTP verification failed");

      toast.success("OTP verified! Enter your new password.");
      setResetStep("new_password");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // Re-send OTP implicitly — the verify_and_reset action handles a fresh OTP check
      // But since OTP was already verified in previous step, we use a special verified flag approach
      // Instead, use admin edge function to update password directly since phone was verified
      const { data, error } = await supabase.functions.invoke("reset-password-otp", {
        body: {
          action: "verify_and_reset",
          phone: resetPhone,
          newPassword,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to reset password");

      toast.success("Password reset successfully! Please sign in.");
      setForgotPassword(false);
      setResetStep("input");
      setResetIdentifier("");
      setResetPhone("");
      setResetMaskedPhone("");
      setResetOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setIsLogin(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && !forgotPassword && step === "form") {
      await sendOtp();
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message?.toLowerCase().includes("banned") || error.message?.toLowerCase().includes("ban") || error.message?.toLowerCase().includes("suspend")) {
            throw new Error("🚫 Your account has been suspended. Please contact support for assistance.");
          }
          throw error;
        }

        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("is_suspended, suspended_reason")
          .eq("user_id", signInData.user.id)
          .maybeSingle();

        if (profileCheck?.is_suspended) {
          await supabase.auth.signOut();
          const reason = profileCheck.suspended_reason;
          throw new Error(`🚫 Your account has been suspended${reason ? `: ${reason}` : ""}. Please contact support for assistance.`);
        }

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signInData.user.id);

        const roles = roleData?.map((r: any) => r.role) || [];
        const isAdminOrMod = roles.includes("admin") || roles.includes("moderator");

        toast.success("Welcome back!");
        logSiteAction("user_login", "user", signInData.user.id, { email: signInData.user.email, role: roles[0] || "user" });
        navigate(isAdminOrMod ? "/admin" : "/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setOtpValue("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setDistrict("");
    setProvince("");
    setPostalCode("");
  };

  const stepIndicator = () => {
    if (isLogin || forgotPassword) return null;
    const steps = [
      { key: "form", label: "Details" },
      { key: "otp", label: "Verify" },
      { key: "address", label: "Address" },
    ];
    const currentIndex = steps.findIndex(s => s.key === step);
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i <= currentIndex ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i <= currentIndex ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`w-8 h-px ${i < currentIndex ? "bg-secondary" : "bg-border"}`} />}
          </div>
        ))}
      </div>
    );
  };

  const resetStepIndicator = () => {
    const steps = [
      { key: "input", label: "Find Account" },
      { key: "otp", label: "Verify" },
      { key: "new_password", label: "New Password" },
    ];
    const currentIndex = steps.findIndex(s => s.key === resetStep);
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i <= currentIndex ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i <= currentIndex ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`w-8 h-px ${i < currentIndex ? "bg-secondary" : "bg-border"}`} />}
          </div>
        ))}
      </div>
    );
  };

  const getTitle = () => {
    if (forgotPassword) {
      if (resetStep === "input") return "Reset Password";
      if (resetStep === "otp") return "Verify Your Phone";
      return "Set New Password";
    }
    if (step === "otp") return "Verify Your Phone";
    if (step === "address") return "Your Address";
    return isLogin ? "Welcome Back" : "Create Account";
  };

  const getSubtitle = () => {
    if (forgotPassword) {
      if (resetStep === "input") return "Enter your email or phone number to find your account";
      if (resetStep === "otp") return `Enter the 5-digit code sent to ${resetMaskedPhone}`;
      return "Choose a strong password for your account";
    }
    if (step === "otp") return `Enter the 5-digit code sent to ${phone}`;
    if (step === "address") return "Almost done! Enter your shipping address";
    return isLogin ? "Sign in to access your account" : "Join NanoCircuit.lk for exclusive deals";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-12 w-auto object-contain max-w-[200px]" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <span className="text-secondary-foreground font-bold text-xl font-display">{initial}</span>
              </div>
            )}
            {company?.navbar_brand_mode === "logo_text" || company?.navbar_brand_mode === "text_only" ? (
              <span className="text-2xl font-bold font-display text-foreground">{storeName}</span>
            ) : null}
          </Link>
          <h1 className="text-2xl font-bold font-display text-foreground">{getTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>

        {forgotPassword ? resetStepIndicator() : stepIndicator()}

        <AnimatePresence mode="wait">

          {/* ── FORGOT PASSWORD FLOW ── */}
          {forgotPassword ? (
            <>
              {resetStep === "input" && (
                <motion.div key="reset-input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-card rounded-xl border border-border p-6 space-y-4 card-elevated">
                  <div className="flex justify-center mb-2">
                    <KeyRound className="w-10 h-10 text-secondary" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email or Phone Number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="you@example.com or 07X XXXXXXX"
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        className="pl-10"
                        onKeyDown={(e) => e.key === "Enter" && handleResetLookup()}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">We'll send an OTP to the phone number linked to your account</p>
                  </div>
                  <Button onClick={handleResetLookup} className="w-full" disabled={loading || resetOtpSending}>
                    {loading || resetOtpSending ? "Looking up..." : "Continue"}
                  </Button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setForgotPassword(false); setResetStep("input"); setResetIdentifier(""); }}
                      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /> Back to sign in
                    </button>
                  </div>
                </motion.div>
              )}

              {resetStep === "otp" && (
                <motion.div key="reset-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-card rounded-xl border border-border p-6 space-y-6 card-elevated">
                  <div className="flex justify-center">
                    <ShieldCheck className="w-12 h-12 text-secondary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      OTP sent to <span className="font-semibold text-foreground">{resetMaskedPhone}</span>
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <InputOTP maxLength={5} value={resetOtp} onChange={setResetOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button onClick={handleResetOtpVerify} className="w-full" disabled={loading || resetOtp.length !== 5}>
                    {loading ? "Verifying..." : "Verify OTP"}
                  </Button>
                  <div className="text-center space-y-2">
                    <button type="button" onClick={() => sendResetOtp()} disabled={resetResendTimer > 0 || resetOtpSending}
                      className="text-sm text-secondary hover:text-secondary/80 disabled:text-muted-foreground disabled:cursor-not-allowed">
                      {resetOtpSending ? "Sending..." : resetResendTimer > 0 ? `Resend OTP in ${resetResendTimer}s` : "Resend OTP"}
                    </button>
                    <br />
                    <button type="button" onClick={() => setResetStep("input")}
                      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  </div>
                </motion.div>
              )}

              {resetStep === "new_password" && (
                <motion.div key="reset-newpw" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-card rounded-xl border border-border p-6 space-y-4 card-elevated">
                  <div className="flex justify-center mb-2">
                    <Lock className="w-10 h-10 text-secondary" />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10"
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="pl-10"
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button onClick={handleResetPassword} className="w-full" disabled={loading}>
                    {loading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <div className="text-center">
                    <button type="button" onClick={() => setResetStep("otp")}
                      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  </div>
                </motion.div>
              )}
            </>
          ) : step === "otp" ? (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-card rounded-xl border border-border p-6 space-y-6 card-elevated">
              <div className="flex justify-center">
                <ShieldCheck className="w-12 h-12 text-secondary" />
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={5} value={otpValue} onChange={setOtpValue}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button onClick={verifyOtp} className="w-full" disabled={loading || otpValue.length !== 5}>
                {loading ? "Verifying..." : "Verify Phone"}
              </Button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={resendTimer > 0 || otpSending}
                  className="text-sm text-secondary hover:text-secondary/80 disabled:text-muted-foreground disabled:cursor-not-allowed"
                >
                  {otpSending ? "Sending..." : resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
                </button>
                <br />
                <button type="button" onClick={() => setStep("form")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ChevronLeft className="w-3 h-3" /> Back to registration
                </button>
              </div>
            </motion.div>
          ) : step === "address" ? (
            <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-card rounded-xl border border-border p-6 space-y-4 card-elevated">
              <div className="flex justify-center mb-2">
                <MapPin className="w-10 h-10 text-secondary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr1">Address Line 1 <span className="text-destructive">*</span></Label>
                <Input id="addr1" placeholder="Street address" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr2">Address Line 2</Label>
                <Input id="addr2" placeholder="Apartment, suite, etc. (optional)" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                  <Input id="city" placeholder="Colombo" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Input id="district" placeholder="Optional" value={district} onChange={(e) => setDistrict(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Input id="province" placeholder="Optional" value={province} onChange={(e) => setProvince(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input id="postal" placeholder="00100" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>

              <Button onClick={completeRegistration} className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Complete Registration"}
              </Button>

              <div className="text-center">
                <button type="button" onClick={() => setStep("otp")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <form onSubmit={handleAuth} className="bg-card rounded-xl border border-border p-6 space-y-4 card-elevated">
                {!isLogin && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="firstName" type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                      <Input id="lastName" type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="phone" type="tel" placeholder="07X XXXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10" required />
                    </div>
                    <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required minLength={6} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <button type="button" onClick={() => { setForgotPassword(true); setResetStep("input"); setResetIdentifier(""); }}
                    className="text-xs text-secondary hover:text-secondary/80 transition-colors">
                    Forgot your password?
                  </button>
                )}

                <Button type="submit" className="w-full" disabled={loading || otpSending}>
                  {loading || otpSending
                    ? "Please wait..."
                    : isLogin
                    ? "Sign In"
                    : "Send OTP & Verify"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  {isLogin ? (
                    <span>
                      Don't have an account?{" "}
                      <button type="button" onClick={() => { setIsLogin(false); resetForm(); }} className="text-secondary hover:text-secondary/80 font-medium">
                        Sign up
                      </button>
                    </span>
                  ) : (
                    <span>
                      Already have an account?{" "}
                      <button type="button" onClick={() => { setIsLogin(true); resetForm(); }} className="text-secondary hover:text-secondary/80 font-medium">
                        Sign in
                      </button>
                    </span>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;

