import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Phone, ShieldCheck } from "lucide-react";

type Step = "form" | "otp";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

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
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setOtpSending(true);
    try {
      const formattedPhone = formatPhone(phone);
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

  const verifyOtpAndRegister = async () => {
    if (otpValue.length !== 5) {
      toast.error("Please enter the 5-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);

      // Verify OTP
      const { data: otpResult, error: otpError } = await supabase.functions.invoke("verify-otp", {
        body: { phone: formattedPhone, otp: otpValue },
      });
      if (otpError) throw otpError;
      if (!otpResult?.success) throw new Error(otpResult?.error || "OTP verification failed");

      // OTP verified — create account
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone: formattedPhone },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) throw signUpError;

      // Update profile with phone_verified
      // This will be handled after email confirmation via trigger

      toast.success("Account created! Please check your email to verify.");
      setStep("form");
      setIsLogin(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For registration, send OTP first
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
        if (error) throw error;
        
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signInData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        toast.success("Welcome back!");
        navigate(roleData ? "/admin" : "/");
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
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <span className="text-secondary-foreground font-bold text-xl font-display">T</span>
            </div>
            <span className="text-2xl font-bold font-display text-foreground">TechLK</span>
          </Link>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {step === "otp"
              ? "Verify Your Phone"
              : forgotPassword
              ? "Reset Password"
              : isLogin
              ? "Welcome Back"
              : "Create Account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "otp"
              ? `Enter the 5-digit code sent to ${phone}`
              : forgotPassword
              ? "Enter your email to receive a reset link"
              : isLogin
              ? "Sign in to access your account"
              : "Join TechLK for exclusive deals"}
          </p>
        </div>

        {step === "otp" ? (
          <div className="bg-card rounded-xl border border-border p-6 space-y-6 card-elevated">
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

            <Button
              onClick={verifyOtpAndRegister}
              className="w-full"
              disabled={loading || otpValue.length !== 5}
            >
              {loading ? "Verifying..." : "Verify & Create Account"}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={sendOtp}
                disabled={resendTimer > 0 || otpSending}
                className="text-sm text-secondary hover:text-secondary/80 disabled:text-muted-foreground disabled:cursor-not-allowed"
              >
                {otpSending
                  ? "Sending..."
                  : resendTimer > 0
                  ? `Resend OTP in ${resendTimer}s`
                  : "Resend OTP"}
              </button>
              <br />
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to registration
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="bg-card rounded-xl border border-border p-6 space-y-4 card-elevated">
            {!isLogin && !forgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {!isLogin && !forgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="07X XXXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
              </div>
            )}

            {!forgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && !forgotPassword && (
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="text-xs text-secondary hover:text-secondary/80 transition-colors"
              >
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
        )}
      </motion.div>
    </div>
  );
};

export default Auth;
