'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Crown, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/AuthContext';
import { PayPalButton } from '@/components/paypal-button';
import { StripeButton } from '@/components/stripe-button';

interface PaypalPlanInfo {
    planId: string;
    price: string;
    currency: string;
    interval: string;
}

interface StripePlanInfo {
    price: string;
    currency: string;
    interval: string;
}

export default function PricingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { token, isPremium, subscription, refreshSubscription, loading: authLoading } = useAuthContext();
    const [paypalPlanInfo, setPaypalPlanInfo] = useState<PaypalPlanInfo | null>(null);
    const [stripePlanInfo, setStripePlanInfo] = useState<StripePlanInfo | null>(null);
    const [loadingPlan, setLoadingPlan] = useState(true);
    const stripeReturnHandled = useRef(false);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !token) {
            router.push('/login');
        }
    }, [authLoading, token, router]);

    // R10: Fetch plan info from both PayPal and Stripe
    useEffect(() => {
        async function fetchPlans() {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            try {
                const [paypalRes, stripeRes] = await Promise.allSettled([
                    fetch(`${apiUrl}/paypal/plan`),
                    fetch(`${apiUrl}/stripe/plan`),
                ]);

                if (paypalRes.status === 'fulfilled' && paypalRes.value.ok) {
                    const data = await paypalRes.value.json();
                    setPaypalPlanInfo(data);
                }

                if (stripeRes.status === 'fulfilled' && stripeRes.value.ok) {
                    const data = await stripeRes.value.json();
                    setStripePlanInfo(data);
                }
            } catch (error) {
                console.error('Failed to fetch plan info:', error);
            } finally {
                setLoadingPlan(false);
            }
        }

        fetchPlans();
    }, []);

    // R11: Handle Stripe return — verify session or show cancellation toast
    useEffect(() => {
        if (authLoading || stripeReturnHandled.current) return;

        const sessionId = searchParams.get('session_id');
        const cancelled = searchParams.get('stripe_cancelled');

        if (sessionId) {
            stripeReturnHandled.current = true;

            const handleStripeSuccess = async () => {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                    const response = await fetch(`${apiUrl}/stripe/verify-session`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ sessionId }),
                    });

                    if (!response.ok) {
                        throw new Error('Falha ao verificar sessão de pagamento');
                    }

                    toast({
                        title: 'Pagamento realizado com sucesso!',
                        description: 'Sua assinatura PRO foi ativada. Aproveite todos os recursos premium!',
                    });

                    await refreshSubscription();

                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                } catch (error) {
                    toast({
                        title: 'Erro ao verificar pagamento',
                        description: error instanceof Error ? error.message : 'Tente novamente ou entre em contato.',
                        variant: 'destructive',
                    });
                }
            };

            handleStripeSuccess();
        } else if (cancelled === 'true') {
            stripeReturnHandled.current = true;
            toast({
                title: 'Pagamento cancelado',
                description: 'Você cancelou o processo de pagamento com Stripe.',
            });
        }
    }, [authLoading, searchParams, token, refreshSubscription, router, toast]);

    const handlePaymentSuccess = async (_subscriptionId: string) => {
        toast({
            title: 'Pagamento realizado com sucesso!',
            description: 'Sua assinatura PRO foi ativada. Aproveite todos os recursos premium!',
        });

        await refreshSubscription();

        setTimeout(() => {
            router.push('/dashboard');
        }, 2000);
    };

    const handlePaymentError = (error: Error) => {
        toast({
            title: 'Erro no pagamento',
            description: error.message || 'Ocorreu um erro ao processar o pagamento. Tente novamente.',
            variant: 'destructive',
        });
    };

    const handlePaymentCancel = () => {
        toast({
            title: 'Pagamento cancelado',
            description: 'Você cancelou o processo de pagamento.',
        });
    };

    const formatPrice = (price: string, currency: string) => {
        const numPrice = parseFloat(price);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency,
        }).format(numPrice);
    };

    const displayPrice = paypalPlanInfo || stripePlanInfo;

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
            <div className="container mx-auto px-4 py-12">
                {/* Back button */}
                <Button
                    variant="ghost"
                    className="mb-8"
                    onClick={() => router.push('/dashboard')}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Painel
                </Button>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Crown className="h-10 w-10 text-amber-500" />
                        <h1 className="text-4xl font-display font-bold tracking-tight">
                            Escolha seu Plano
                        </h1>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Desbloqueie todo o potencial do WPP Manager com uma assinatura premium.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Free Plan */}
                    <Card className="relative border-2 border-border/50">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-2xl">Gratuito</CardTitle>
                                {!isPremium && (
                                    <Badge variant="secondary">Plano Atual</Badge>
                                )}
                            </div>
                            <CardDescription>
                                Para começar a explorar
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">R$ 0</span>
                                <span className="text-muted-foreground">/mês</span>
                            </div>

                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" />
                                    <span>Acesso ao painel</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" />
                                    <span>Visualização de instâncias</span>
                                </li>
                                <li className="flex items-center gap-2 text-muted-foreground">
                                    <span className="h-5 w-5 flex items-center justify-center">✕</span>
                                    <span>Criação de instâncias</span>
                                </li>
                                <li className="flex items-center gap-2 text-muted-foreground">
                                    <span className="h-5 w-5 flex items-center justify-center">✕</span>
                                    <span>Suporte prioritário</span>
                                </li>
                            </ul>

                            <Button variant="outline" className="w-full" disabled>
                                {!isPremium ? 'Plano Atual' : 'Plano Gratuito'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* PRO Plan */}
                    <Card className="relative border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                <Sparkles className="mr-1 h-3 w-3" />
                                Recomendado
                            </Badge>
                        </div>

                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-2xl flex items-center gap-2">
                                    <Crown className="h-6 w-6 text-amber-500" />
                                    PRO
                                </CardTitle>
                                {isPremium && (
                                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                        Plano Atual
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Para profissionais e empresas
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6">
                                {loadingPlan ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                    <>
                                        <span className="text-4xl font-bold">
                                            {displayPrice
                                                ? formatPrice(displayPrice.price, displayPrice.currency)
                                                : 'R$ 100,00'}
                                        </span>
                                        <span className="text-muted-foreground">/mês</span>
                                    </>
                                )}
                            </div>

                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-amber-500" />
                                    <span>Tudo do plano Gratuito</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-amber-500" />
                                    <span className="font-medium">Instâncias ilimitadas</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-amber-500" />
                                    <span>Webhooks personalizados</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-amber-500" />
                                    <span>Recursos avançados de IA</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-amber-500" />
                                    <span>Suporte prioritário</span>
                                </li>
                            </ul>

                            {isPremium ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Você já possui o plano PRO
                                    </p>
                                    {subscription?.expiresAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Válido até: {new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* R10: Both payment options shown */}
                                    <p className="text-xs text-center text-muted-foreground">
                                        Escolha sua forma de pagamento
                                    </p>
                                    <PayPalButton
                                        planId={paypalPlanInfo?.planId || ''}
                                        onSuccess={handlePaymentSuccess}
                                        onError={handlePaymentError}
                                        onCancel={handlePaymentCancel}
                                        disabled={isPremium || loadingPlan}
                                    />
                                    <StripeButton
                                        onError={handlePaymentError}
                                        disabled={isPremium || loadingPlan}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* FAQ */}
                <div className="mt-16 max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl font-display font-bold mb-4">
                        Perguntas Frequentes
                    </h2>
                    <div className="space-y-4 text-left">
                        <div className="p-4 rounded-lg bg-secondary/30">
                            <h3 className="font-semibold mb-2">Como funciona a cobrança?</h3>
                            <p className="text-sm text-muted-foreground">
                                A cobrança é feita mensalmente via PayPal ou Stripe. Você pode cancelar a qualquer momento.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/30">
                            <h3 className="font-semibold mb-2">Posso cancelar minha assinatura?</h3>
                            <p className="text-sm text-muted-foreground">
                                Sim! Você pode cancelar sua assinatura a qualquer momento através do PayPal ou Stripe, ou entrando em contato conosco.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/30">
                            <h3 className="font-semibold mb-2">O que acontece quando cancelo?</h3>
                            <p className="text-sm text-muted-foreground">
                                Ao cancelar, você continua com acesso PRO até o final do período pago. Após isso, sua conta volta ao plano gratuito.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
