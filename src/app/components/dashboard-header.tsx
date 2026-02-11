'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowRight, PlusCircle, RefreshCw, Sparkles, Crown, Lock, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthContext } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  instanceName: z.string().min(3, {
    message: 'O nome da instância deve ter pelo menos 3 caracteres.',
  }).max(50, {
    message: 'O nome da instância não pode exceder 50 caracteres.',
  }),
});

type DashboardHeaderProps = {
  hasInstances: boolean;
  onRefresh?: () => void;
};

export function DashboardHeader({ hasInstances, onRefresh }: DashboardHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { token, isPremium, isSubUser, subscription } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentInstanceName, setCurrentInstanceName] = useState<string | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instanceName: '',
    },
  });

  async function handleUpdate() {
    setIsUpdating(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }

      toast({
        title: 'Atualizado',
        description: 'O painel foi atualizado.',
      });
    } catch (error: any) {
      toast({
        title: 'Falha na Atualização',
        description: error?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setIsUpdating(false);
      }, 500);
    }
  }

  async function configureWebhook(instanceName: string) {
    if (!token) {
      console.error('Token de autenticação não disponível');
      toast({
        title: 'Erro de Autenticação',
        description: 'Por favor, faça login novamente para configurar webhooks.',
        variant: 'destructive',
      });
      return;
    }

    console.log('Configurando webhook para instância:', instanceName);

    try {
      const response = await fetch(`/api/instances/${encodeURIComponent(instanceName)}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Falha na configuração do webhook:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        throw new Error(data.error || `Falha ao configurar webhook (${response.status})`);
      }

      console.log('Webhook configurado com sucesso para instância:', instanceName, data);
      toast({
        title: 'Webhook Configurado',
        description: `Webhook configurado com sucesso para "${instanceName}".`,
      });
    } catch (error: any) {
      console.error('Falha ao configurar webhook:', error);
      toast({
        title: 'Falha na Configuração do Webhook',
        description: error?.message || 'Falha ao configurar webhook para a instância.',
        variant: 'destructive',
      });
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/instances/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ instanceName: values.instanceName }),
      });

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        throw new Error((data && (data.error || data.message)) || 'Falha ao criar instância');
      }

      const base64Png: string | undefined = data?.qrcode?.base64;
      if (base64Png && typeof base64Png === 'string') {
        const cleaned = base64Png.replace(/^data:image\/png;base64,/, '');
        setImageSrc(`data:image/png;base64,${cleaned}`);
      } else {
        setImageSrc(null);
      }

      toast({
        title: 'Conexão Iniciada',
        description: `A instância "${values.instanceName}" está sendo configurada.`,
      });

      setCurrentInstanceName(values.instanceName);
      setIsConnectDialogOpen(false);
      setIsQrDialogOpen(true);
      form.reset();

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error: any) {
      toast({
        title: 'Falha na Conexão',
        description: error?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleConnectClick = () => {
    if (isPremium) {
      setIsConnectDialogOpen(true);
    } else {
      setIsUpgradeDialogOpen(true);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="animate-fade-in">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Painel
            </h1>
            {isSubUser ? (
              <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400">
                <Users className="mr-1 h-3 w-3" />
                SUB-USUÁRIO
              </Badge>
            ) : subscription && (
              <Badge
                variant={isPremium ? "default" : "secondary"}
                className={isPremium ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" : ""}
              >
                {isPremium ? (
                  <>
                    <Crown className="mr-1 h-3 w-3" />
                    {subscription.tier.toUpperCase()}
                  </>
                ) : (
                  'FREE'
                )}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gerencie e monitore suas instâncias de bot do WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-3 animate-slide-in-right">
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
            variant="outline"
            className="h-10 px-4 border-border/60 hover:bg-secondary/80 transition-all"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {isPremium && !isSubUser && (
            <Button
              onClick={() => router.push('/dashboard/sub-users')}
              variant="outline"
              className="h-10 px-4 border-border/60 hover:bg-secondary/80 transition-all"
            >
              <Users className="mr-2 h-4 w-4" />
              Sub-Usuários
            </Button>
          )}
          {!isSubUser && (
            <Button
              onClick={handleConnectClick}
              className={`h-10 px-5 transition-all ${isPremium
                  ? 'gradient-primary hover:opacity-90 shadow-glow'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
            >
              {isPremium ? (
                <PlusCircle className="mr-2 h-4 w-4" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Conectar Nova Instância
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de Conexão */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Conectar Nova Instância</DialogTitle>
            <DialogDescription>
              Crie uma nova instância de bot do WhatsApp para começar a automatizar suas mensagens.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              <FormField
                control={form.control}
                name="instanceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Instância</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Atendimento ao Cliente"
                        {...field}
                        className="h-11 bg-background/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 gradient-primary hover:opacity-90 shadow-glow transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Criar Instância
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog do QR Code */}
      <Dialog open={isQrDialogOpen} onOpenChange={(open) => {
        setIsQrDialogOpen(open);
        if (!open) {
          handleUpdate();
          if (currentInstanceName) {
            configureWebhook(currentInstanceName);
            setCurrentInstanceName(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Escanear QR Code</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no seu celular e escaneie este código para conectar.
            </DialogDescription>
          </DialogHeader>
          {imageSrc ? (
            <div className="flex items-center justify-center p-4">
              <div className="relative p-4 bg-white rounded-xl shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="QR Code do WhatsApp"
                  className="max-h-[60vh] w-auto rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Carregando QR code...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Upgrade Premium */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Recurso Premium
            </DialogTitle>
            <DialogDescription>
              A criação de instâncias é um recurso exclusivo para assinantes premium.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-6 border border-amber-500/20">
              <h3 className="font-semibold text-lg mb-3">Benefícios do plano Premium:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Criar instâncias ilimitadas de bots
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Suporte prioritário
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Acesso a recursos avançados de IA
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Webhooks personalizados
                </li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsUpgradeDialogOpen(false)}
            >
              Fechar
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              onClick={() => {
                setIsUpgradeDialogOpen(false);
                router.push('/pricing');
              }}
            >
              <Crown className="mr-2 h-4 w-4" />
              Fazer Upgrade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
