'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

declare global {
    interface Window {
        paypal?: any;
    }
}

interface PayPalButtonProps {
    planId: string;
    onSuccess: (subscriptionId: string) => void;
    onError: (error: Error) => void;
    onCancel?: () => void;
    disabled?: boolean;
}

export function PayPalButton({ planId, onSuccess, onError, onCancel, disabled }: PayPalButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [sdkReady, setSdkReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const buttonRenderedRef = useRef(false);
    const planIdRef = useRef(planId);

    // Keep planId ref updated
    useEffect(() => {
        planIdRef.current = planId;
    }, [planId]);

    // Load PayPal SDK
    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

        if (!clientId) {
            console.error('PayPal Client ID not configured');
            setError('PayPal não configurado');
            setLoading(false);
            return;
        }

        // Check if SDK is already loaded
        if (window.paypal) {
            setSdkReady(true);
            setLoading(false);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription&currency=BRL`;
        script.async = true;

        script.onload = () => {
            setSdkReady(true);
            setLoading(false);
        };

        script.onerror = () => {
            console.error('Failed to load PayPal SDK');
            setError('Falha ao carregar PayPal');
            setLoading(false);
        };

        document.body.appendChild(script);

        return () => {
            // Don't remove script to allow reuse
        };
    }, []);

    // Render PayPal buttons
    const renderButtons = useCallback(async () => {
        if (!window.paypal || !containerRef.current || buttonRenderedRef.current || disabled || !planId) {
            return;
        }

        buttonRenderedRef.current = true;

        try {
            // Clear container first
            containerRef.current.innerHTML = '';

            console.log('Rendering PayPal button with plan ID:', planId);

            window.paypal.Buttons({
                style: {
                    shape: 'rect',
                    color: 'gold',
                    layout: 'vertical',
                    label: 'subscribe',
                },
                createSubscription: (_data: any, actions: any) => {
                    console.log('Creating subscription with plan ID:', planIdRef.current);

                    if (!planIdRef.current) {
                        throw new Error('Plan ID is missing');
                    }

                    return actions.subscription.create({
                        plan_id: planIdRef.current,
                    });
                },
                onApprove: async (data: any) => {
                    console.log('Subscription approved:', data.subscriptionID);

                    // Activate the subscription on our backend
                    try {
                        const activateResponse = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL}/paypal/activate-subscription/${data.subscriptionID}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('wppmanager_token')}`,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );

                        if (!activateResponse.ok) {
                            throw new Error('Falha ao ativar assinatura');
                        }

                        onSuccess(data.subscriptionID);
                    } catch (error) {
                        console.error('Activation error:', error);
                        onError(error instanceof Error ? error : new Error('Falha ao ativar assinatura'));
                    }
                },
                onCancel: () => {
                    console.log('Subscription cancelled by user');
                    onCancel?.();
                },
                onError: (err: any) => {
                    console.error('PayPal error:', err);
                    onError(new Error('Erro no processamento do PayPal'));
                },
            }).render(containerRef.current);
        } catch (error) {
            console.error('Failed to render PayPal buttons:', error);
            setError('Falha ao renderizar botão PayPal');
            onError(error instanceof Error ? error : new Error('Falha ao renderizar botão PayPal'));
        }
    }, [disabled, planId, onSuccess, onError, onCancel]);

    useEffect(() => {
        if (sdkReady && !disabled && planId) {
            renderButtons();
        }
    }, [sdkReady, disabled, planId, renderButtons]);

    // Reset button when disabled changes or planId changes
    useEffect(() => {
        if (disabled || !planId) {
            buttonRenderedRef.current = false;
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        }
    }, [disabled, planId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando PayPal...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-4 text-center text-red-500">
                {error}
            </div>
        );
    }

    if (!planId) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando plano...</span>
            </div>
        );
    }

    if (disabled) {
        return (
            <div className="py-4 text-center text-muted-foreground">
                PayPal desabilitado
            </div>
        );
    }

    return (
        <div ref={containerRef} className="min-h-[150px]" />
    );
}
