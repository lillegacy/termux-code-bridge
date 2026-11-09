import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-mono text-sm font-semibold text-primary">
          <Terminal className="h-4 w-4" /> termux.hub
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/gateway" activeProps={{ className: "text-foreground" }}>Gateway</Link>
          <Link to="/devices" activeProps={{ className: "text-foreground" }}>Devices</Link>
          <Link to="/docs" activeProps={{ className: "text-foreground" }}>Docs</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email ? (
            <>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{email}</span>
              <Button size="sm" variant="outline" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <Button size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          )}
        </div>
      </div>
    </header>
  );
}
