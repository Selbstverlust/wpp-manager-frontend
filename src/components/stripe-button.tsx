'use client';

import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StripeButtonProps {
    onError: (error: Error) => void;
    disabled?: boolean;
}

export function StripeButton({ onError, disabled }: StripeButtonProps) {
    const [loading, setLoading] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    // Validate publishable key is configured (R9)
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey && !configError) {
        setConfigError('Stripe não configurado');
    }

    const handleClick = async () => {
        if (loading || disabled) return;

        setLoading(true);

        try {
            const token = localStorage.getItem('wppmanager_token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const currentUrl = window.location.href.split('?')[0];

            const response = await fetch(`${apiUrl}/stripe/create-session`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    success_url: `${currentUrl}?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${currentUrl}?stripe_cancelled=true`,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.message || 'Falha ao iniciar checkout');
            }

            const { checkoutUrl } = await response.json();
            window.location.href = checkoutUrl;
        } catch (error) {
            setLoading(false);
            onError(error instanceof Error ? error : new Error('Erro ao processar pagamento com Stripe'));
        }
    };

    if (configError) {
        return (
            <div className="py-4 text-center text-destructive text-sm">
                {configError}
            </div>
        );
    }

    return (
        <Button
            onClick={handleClick}
            disabled={loading || disabled}
            className="w-full"
            variant="outline"
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecionando...
                </>
            ) : (
                <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar com Stripe
                </>
            )}
        </Button>
    );
}
