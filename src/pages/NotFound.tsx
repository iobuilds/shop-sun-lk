import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold font-display text-destructive">404</span>
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Redirecting to home in <span className="font-bold text-foreground">{countdown}</span> seconds...
        </p>
        <div className="w-full bg-muted rounded-full h-1.5 mb-6">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((10 - countdown) / 10) * 100}%` }}
          />
        </div>
        <Button onClick={() => navigate("/")} className="gap-2">
          <Home className="w-4 h-4" /> Go Home Now
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
