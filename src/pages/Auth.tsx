import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Phone, ShieldCheck, MapPin, ChevronLeft } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { logSiteAction } from "@/lib/logSiteAction";

type Step = "form" | "otp" | "address";

const Auth = () => {
  const { storeName, logoUrl, initial } = useBranding();
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

      // Check if phone is already registered
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", formattedPhone)
        .maybeSingle();
      if (existingProfile) {
        toast.error("This phone number is already registered. Please log in instead.");
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !forgotPassword && step === "form") {
      await sendOtp();
      return;
    }

    setLoading(true);
    try {
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent! Check your inbox.");
        setForgotPassword(false);
      } else if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message?.includes("banned") || error.message?.includes("ban")) {
            throw new Error("Your account is suspended. Please contact support.");
          }
          throw error;
        }

        // Double-check suspension in profile
        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("is_suspended")
          .eq("user_id", signInData.user.id)
          .maybeSingle();
        
        if (profileCheck?.is_suspended) {
          await supabase.auth.signOut();
          throw new Error("Your account is suspended. Please contact support.");
        }
        
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signInData.user.id);
        
        const roles = roleData?.map((r: any) => r.role) || [];
        const isAdminOrMod = roles.includes("admin") || roles.includes("moderator");
        
        toast.success("Welcome back!");
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
              <img src={logoUrl} alt={storeName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <span className="text-secondary-foreground font-bold text-xl font-display">{initial}</span>
              </div>
            )}
            <span className="text-2xl font-bold font-display text-foreground">{storeName}</span>
          </Link>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {step === "otp"
              ? "Verify Your Phone"
              : step === "address"
              ? "Your Address"
              : forgotPassword
              ? "Reset Password"
              : isLogin
              ? "Welcome Back"
              : "Create Account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "otp"
              ? `Enter the 5-digit code sent to ${phone}`
              : step === "address"
              ? "Almost done! Enter your shipping address"
              : forgotPassword
              ? "Enter your email to receive a reset link"
              : isLogin
              ? "Sign in to access your account"
              : "Join TechLK for exclusive deals"}
          </p>
        </div>

        {stepIndicator()}

        <AnimatePresence mode="wait">
          {step === "otp" ? (
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
                {!isLogin && !forgotPassword && (
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

                {!isLogin && !forgotPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="phone" type="tel" placeholder="07X XXXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10" required />
                    </div>
                    <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
                  </div>
                )}

                {!forgotPassword && (
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
                )}

                {isLogin && !forgotPassword && (
                  <button type="button" onClick={() => setForgotPassword(true)} className="text-xs text-secondary hover:text-secondary/80 transition-colors">
                    Forgot your password?
                  </button>
                )}

                <Button type="submit" className="w-full" disabled={loading || otpSending}>
                  {loading || otpSending
                    ? "Please wait..."
                    : forgotPassword
                    ? "Send Reset Link"
                    : isLogin
                    ? "Sign In"
                    : "Send OTP & Verify"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  {forgotPassword ? (
                    <button type="button" onClick={() => setForgotPassword(false)} className="text-secondary hover:text-secondary/80">
                      Back to sign in
                    </button>
                  ) : isLogin ? (
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
