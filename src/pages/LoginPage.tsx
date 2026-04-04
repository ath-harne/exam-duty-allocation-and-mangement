import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, Lock, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAppState();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(username, password)) {
      toast.success('Login successful');
      navigate('/dashboard');
    } else {
      toast.error('Invalid username or password.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-card hidden p-8 lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div>
            <span className="hero-badge">
              <ShieldCheck className="h-3.5 w-3.5" />
              Examination Control
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-tight text-balance text-foreground xl:text-5xl">
              A professional workspace for disciplined exam duty management.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
              Use one clear workspace to upload records, run duty allocation, and download the required reports for the exam department.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Faculty Ready</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Upload the latest faculty file before starting the duty allocation process.</p>
            </div>
            <div className="glass-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Duty Planning</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Generate duty allocation after uploading the examination schedule.</p>
            </div>
            <div className="glass-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reports</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Review the final allocation result and download the available reports.</p>
            </div>
          </div>
        </section>

        <section className="glass-card flex items-center justify-center p-6 sm:p-8 xl:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/55 bg-white/55 text-primary shadow-[0_18px_45px_rgba(39,92,127,0.18)] backdrop-blur-md">
                <GraduationCap className="h-10 w-10" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-foreground">Exam Cell Portal</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Sign in to continue to the examination planning and duty allocation workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-foreground">Username</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/45 bg-white/30 px-4 py-4 text-sm leading-6 text-muted-foreground backdrop-blur-md">
              This portal is designed for examination section use, helping staff maintain clarity, consistency, and readiness throughout the duty allocation process.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
