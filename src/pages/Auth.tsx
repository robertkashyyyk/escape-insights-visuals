import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const isCleaner = (role as string) === "cleaner";
  const isClient = (role as string) === "client";
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginWorkspaceRedirect = useCallback((replace = true) => {
    if (redirectTimerRef.current) return;
    setShowTransition(true);
    redirectTimerRef.current = setTimeout(() => {
      const dest = isClient ? "/owner" : isCleaner ? "/cleaner" : "/today";
      navigate(dest, { replace });
    }, 3000);
  }, [isClient, isCleaner, navigate]);

  // Show the "Preparing your workspace…" animation for ALL authenticated arrivals
  // (magic-link returns, refreshed sessions, and post-password-login), not just
  // after a fresh password login.
  useEffect(() => {
    if (!authLoading && user) {
      beginWorkspaceRedirect(true);
    }
  }, [authLoading, user, beginWorkspaceRedirect]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLoginSuccess = () => {
    beginWorkspaceRedirect(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Land on /auth so AuthContext loads role, then route accordingly.
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a magic link to sign in.",
      });
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      handleLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {showTransition ? (
          /* Login transition */
          <motion.div
            key="transition"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Radial glow behind icon */}
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Icon */}
            <motion.img
              src="/images/eg_icon_standalone.png"
              alt="Escape Grids"
              className="h-24 w-24 object-contain relative z-10"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Welcome text */}
            <motion.p
              className="mt-6 text-sm text-muted-foreground font-medium tracking-wide relative z-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
            >
              Preparing your workspace…
            </motion.p>

            {/* Progress bar */}
            <motion.div
              className="mt-6 h-[2px] bg-border/30 rounded-full overflow-hidden w-48 relative z-10"
            >
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>

            {/* Fade out at the end */}
            <motion.div
              className="fixed inset-0 bg-background z-20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 2.6, ease: "easeIn" }}
            />
          </motion.div>
        ) : (
          /* Login form */
          <motion.div
            key="form"
            className="w-full max-w-md relative z-10"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
          >
            {/* Logo */}
            <div className="flex justify-center mb-10">
              <img
                src="/images/eg_icon_standalone.png"
                alt="Escape Grids"
                className="h-20 w-20 object-contain"
              />
            </div>

            <Card className="border-border/30 bg-card/50 backdrop-blur-xl shadow-2xl">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-semibold text-foreground font-display">
                  Welcome back
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Sign in with your email to continue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="password" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="password">Password</TabsTrigger>
                    <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
                  </TabsList>

                  <TabsContent value="password">
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password-email" className="text-sm text-foreground/80">
                          Email address
                        </Label>
                        <Input
                          id="password-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-secondary/50 border-border/40 focus:border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm text-foreground/80">
                          Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-secondary/50 border-border/40 focus:border-primary/50 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Lock className="h-4 w-4 mr-2" />
                        )}
                        Sign In
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="magic-link">
                    {sent ? (
                      <div className="text-center py-6 space-y-3">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Mail className="h-7 w-7 text-primary" />
                        </div>
                        <h3 className="text-foreground font-semibold text-lg font-display">
                          Check your inbox
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          We sent a magic link to <span className="text-foreground font-medium">{email}</span>. Click the link to sign in.
                        </p>
                        <Button
                          variant="ghost"
                          className="text-primary hover:text-primary/80 mt-2"
                          onClick={() => setSent(false)}
                        >
                          Try a different email
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleMagicLink} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="magic-email" className="text-sm text-foreground/80">
                            Email address
                          </Label>
                          <Input
                            id="magic-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-secondary/50 border-border/40 focus:border-primary/50"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Send Magic Link
                        </Button>
                      </form>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-4 border-t border-border/30">
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>
                      This is an invite-only platform. If you don't have access, please contact your administrator.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
