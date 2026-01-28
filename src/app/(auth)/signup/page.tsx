'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { MessageCircle, ArrowRight, Loader2, Shield, Zap, Bot } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SignupPage() {
  const { register, loading } = useAuth();
  const [formState, setFormState] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (formState.password !== formState.confirmPassword) {
      setError('As senhas não coincidem');
      setSubmitting(false);
      return;
    }

    if (formState.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setSubmitting(false);
      return;
    }

    try {
      await register(formState.email, formState.name, formState.password);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Falha no cadastro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || loading;

  const features = [
    { icon: Bot, text: 'Instâncias de bot ilimitadas' },
    { icon: Zap, text: 'Processamento de mensagens em tempo real' },
    { icon: Shield, text: 'Segurança de nível empresarial' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Painel Esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        {/* Elementos decorativos */}
        <div className="absolute inset-0 pattern-dots opacity-10" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <MessageCircle className="h-8 w-8" />
            </div>
            <span className="text-2xl font-display font-semibold">WPP Manager</span>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-display font-bold leading-tight mb-6">
            Comece a automatizar seu WhatsApp hoje
          </h1>
          
          <p className="text-lg text-white/80 mb-10 max-w-md">
            Junte-se a milhares de empresas usando nossa plataforma para escalar suas comunicações com clientes.
          </p>
          
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 text-white/90"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-2 bg-white/10 rounded-lg">
                  <feature.icon className="h-5 w-5" />
                </div>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel Direito - Formulário de Cadastro */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        {/* Toggle de Tema */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="p-3 gradient-primary rounded-xl shadow-glow">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <span className="text-xl font-display font-semibold text-foreground">WPP Manager</span>
          </div>

          <Card className="border-0 shadow-soft bg-card/50 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-display font-bold text-center">
                Crie sua conta
              </CardTitle>
              <CardDescription className="text-center text-base">
                Comece com sua conta gratuita
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="animate-scale-in">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="João Silva"
                    disabled={disabled}
                    className="h-11 px-4 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formState.email}
                    onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="seu@email.com"
                    disabled={disabled}
                    className="h-11 px-4 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={formState.password}
                    onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="••••••••"
                    disabled={disabled}
                    className="h-11 px-4 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={formState.confirmPassword}
                    onChange={(event) => setFormState((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    placeholder="••••••••"
                    disabled={disabled}
                    className="h-11 px-4 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium gradient-primary hover:opacity-90 transition-opacity shadow-glow mt-2"
                  disabled={disabled}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      Criar Conta
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-center text-sm text-muted-foreground">
                  Já tem uma conta?{' '}
                  <Link 
                    href="/login" 
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Entrar
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
