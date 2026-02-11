'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, QrCode, Pencil, Loader2, Phone, Calendar, Hash, Wifi, WifiOff, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';

type InstanceItem = {
  id?: string | null;
  name?: string | null;
  number?: string | null;
  createdAt?: string | null;
};

type ConnectionState = 'open' | 'disconnected' | 'connecting';

type InstanceState = {
  state: ConnectionState | null;
  loading: boolean;
};

type ExamplePrompt = {
  id: string;
  name: string;
  prompt: string;
};

type Props = {
  items: any[];
  onRefresh?: () => void;
};

export function InstancesGrid(props: Props) {
  const { items, onRefresh } = props;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoadingId, setIsLoadingId] = useState<string | null>(null);
  const [instanceStates, setInstanceStates] = useState<Record<string, InstanceState>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [editingInstanceName, setEditingInstanceName] = useState<string | null>(null);
  const [currentQrInstanceName, setCurrentQrInstanceName] = useState<string | null>(null);
  const [examplePrompts, setExamplePrompts] = useState<ExamplePrompt[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { token, isSubUser } = useAuthContext();

  useEffect(() => {
    async function fetchConnectionStates() {
      const statePromises = items.map(async (item: InstanceItem) => {
        const name = item?.name;
        if (!name) return { name, state: null };

        try {
          const res = await fetch(`/api/instances/${encodeURIComponent(name)}/state`, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!res.ok) {
            return { name, state: null };
          }

          const data = await res.json();
          const state = data?.instance?.state as ConnectionState | null;
          return { name, state };
        } catch {
          return { name, state: null };
        }
      });

      const results = await Promise.all(statePromises);
      const statesMap: Record<string, InstanceState> = {};
      
      results.forEach(({ name, state }) => {
        if (name) {
          statesMap[name] = { state, loading: false };
        }
      });

      setInstanceStates(statesMap);
    }

    if (items.length > 0) {
      const initialStates: Record<string, InstanceState> = {};
      items.forEach((item: InstanceItem) => {
        if (item?.name) {
          initialStates[item.name] = { state: null, loading: true };
        }
      });
      setInstanceStates(initialStates);
      fetchConnectionStates();
    }
  }, [items]);

  async function handleShowQr(instanceName: string | null | undefined) {
    if (!instanceName) return;
    setIsLoadingId(instanceName);
    setImageSrc(null);
    setCurrentQrInstanceName(instanceName);
    try {
      const res = await fetch(`/api/instances/${encodeURIComponent(instanceName)}/connect`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || 'Falha ao buscar QR');
      }
      const base64Png: string | undefined = data?.base64;
      if (base64Png && typeof base64Png === 'string') {
        const cleaned = base64Png.replace(/^data:image\/png;base64,/, '');
        setImageSrc(`data:image/png;base64,${cleaned}`);
      } else {
        setImageSrc(null);
      }
      setIsDialogOpen(true);
    } catch {
      setImageSrc(null);
      setIsDialogOpen(true);
    } finally {
      setIsLoadingId(null);
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

  async function handleDeleteInstance() {
    if (!instanceToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/instances/${encodeURIComponent(instanceToDelete)}/delete`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao excluir instância');
      }

      toast({
        title: 'Instância Excluída',
        description: data?.response?.message || `A instância "${instanceToDelete}" foi excluída com sucesso.`,
      });

      setDeleteDialogOpen(false);
      setInstanceToDelete(null);

      // Wait 1 second before refreshing to allow backend to process the deletion
      if (onRefresh) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await onRefresh();
      }
    } catch (error) {
      toast({
        title: 'Falha na Exclusão',
        description: error instanceof Error ? error.message : 'Falha ao excluir instância',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function openDeleteDialog(instanceName: string) {
    setInstanceToDelete(instanceName);
    setDeleteDialogOpen(true);
  }

  async function handleEditPrompt(instanceName: string) {
    setEditingInstanceName(instanceName);
    setIsLoadingPrompt(true);
    setCurrentPrompt('');
    setEditPromptOpen(true);

    setIsLoadingExamples(true);
    try {
      const examplesRes = await fetch('/api/example-prompts', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (examplesRes.ok) {
        const examplesData = await examplesRes.json();
        setExamplePrompts(examplesData || []);
      }
    } catch (error) {
      console.error('Falha ao buscar prompts de exemplo:', error);
      setExamplePrompts([]);
    } finally {
      setIsLoadingExamples(false);
    }

    try {
      const res = await fetch(`/api/instances/${encodeURIComponent(instanceName)}/prompt`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao buscar prompt');
      }

      setCurrentPrompt(data?.prompt || '');
    } catch (error) {
      toast({
        title: 'Falha ao Carregar Prompt',
        description: error instanceof Error ? error.message : 'Falha ao buscar prompt',
        variant: 'destructive',
      });
      setCurrentPrompt('');
    } finally {
      setIsLoadingPrompt(false);
    }
  }

  async function handleSavePrompt() {
    if (!editingInstanceName) return;

    setIsSavingPrompt(true);

    try {
      const res = await fetch(`/api/instances/${encodeURIComponent(editingInstanceName)}/prompt`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao salvar prompt');
      }

      toast({
        title: 'Prompt Salvo',
        description: `O prompt para "${editingInstanceName}" foi atualizado com sucesso.`,
      });

      setEditPromptOpen(false);
    } catch (error) {
      toast({
        title: 'Falha ao Salvar',
        description: error instanceof Error ? error.message : 'Falha ao salvar prompt',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPrompt(false);
    }
  }

  function handleExamplePromptSelect(exampleId: string) {
    const selectedExample = examplePrompts.find(example => example.id === exampleId);
    if (selectedExample) {
      setCurrentPrompt(selectedExample.prompt);
    }
  }

  function toRelative(iso?: string | null): string {
    if (!iso) return '-';
    const created = new Date(iso);
    if (isNaN(created.getTime())) return '-';
    const diffMs = Date.now() - created.getTime();
    const sec = Math.max(1, Math.floor(diffMs / 1000));
    const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
      [60, 'second'],
      [60, 'minute'],
      [24, 'hour'],
      [7, 'day'],
      [4.34524, 'week'],
      [12, 'month'],
      [Number.POSITIVE_INFINITY, 'year'],
    ];
    let value = sec;
    let unit: Intl.RelativeTimeFormatUnit = 'second';
    let i = 0;
    while (i < units.length - 1 && value >= units[i][0]) {
      value = Math.floor(value / units[i][0]);
      unit = units[i + 1][1];
      i++;
    }
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
    return rtf.format(-value, unit);
  }

  const getStateConfig = (state: ConnectionState | null) => {
    switch (state) {
      case 'open':
        return { 
          color: 'bg-success', 
          label: 'Conectado',
          icon: Wifi,
          textColor: 'text-success'
        };
      case 'disconnected':
        return { 
          color: 'bg-destructive', 
          label: 'Desconectado',
          icon: WifiOff,
          textColor: 'text-destructive'
        };
      case 'connecting':
        return { 
          color: 'bg-warning', 
          label: 'Conectando',
          icon: Radio,
          textColor: 'text-warning'
        };
      default:
        return { 
          color: 'bg-muted-foreground/40', 
          label: 'Desconhecido',
          icon: Radio,
          textColor: 'text-muted-foreground'
        };
    }
  };

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it: InstanceItem, idx: number) => {
          const id = it?.id ?? '';
          const name = it?.name ?? 'Sem nome';
          const numberRaw = it?.number ?? null;
          const numberDisplay = numberRaw ? `+${String(numberRaw).replace(/^\+?/, '')}` : 'Não conectado';
          const relativeTime = toRelative(it?.createdAt ?? null);

          const loading = isLoadingId === name;
          const instanceState = instanceStates[name];
          const connectionState = instanceState?.state;
          const isConnected = connectionState === 'open';
          const isLoadingState = instanceState?.loading ?? true;
          const stateConfig = getStateConfig(connectionState);
          const StateIcon = stateConfig.icon;

          return (
            <Card 
              key={id || idx} 
              className="group relative overflow-hidden border-border/60 shadow-soft hover:shadow-glow transition-all duration-300 hover:-translate-y-1 animate-fade-in-up bg-card/80 backdrop-blur-sm"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Linha indicadora de status */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${stateConfig.color} opacity-80`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg font-display font-semibold truncate">
                    {name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLoadingState ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className={`w-2 h-2 rounded-full ${stateConfig.color} animate-pulse`} />
                        <span className={`text-xs font-medium ${stateConfig.textColor}`}>
                          {stateConfig.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!isLoadingState && (
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono truncate">{id}</span>
                  </CardDescription>
                )}
              </CardHeader>
              
              {!isLoadingState && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className={numberRaw ? 'font-medium' : 'text-muted-foreground'}>
                        {numberDisplay}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Criado {relativeTime}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {!isConnected && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleShowQr(name)} 
                        disabled={loading}
                        className="flex-1 min-w-[100px] h-9"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        {loading ? 'Carregando...' : 'Ver QR Code'}
                      </Button>
                    )}
                    {isConnected && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleEditPrompt(name)}
                        className="flex-1 min-w-[100px] h-9"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar Prompt
                      </Button>
                    )}
                    {!isSubUser && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(name)}
                        title="Excluir instância"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
              
              {isLoadingState && (
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialog do QR Code */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open && currentQrInstanceName) {
          configureWebhook(currentQrInstanceName);
          setCurrentQrInstanceName(null);
          // Refresh instances after closing QR modal
          if (onRefresh) {
            onRefresh();
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância <strong>"{instanceToDelete}"</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInstance}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Edição de Prompt */}
      <Dialog open={editPromptOpen} onOpenChange={setEditPromptOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Editar Prompt</DialogTitle>
            <DialogDescription>
              Configure o prompt de IA para <strong>{editingInstanceName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {/* Dropdown de Prompts de Exemplo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Carregar Prompt de Exemplo:</label>
            <Select onValueChange={handleExamplePromptSelect} disabled={isLoadingExamples}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder={isLoadingExamples ? "Carregando exemplos..." : "Selecione um prompt de exemplo"} />
              </SelectTrigger>
              <SelectContent>
                {examplePrompts.map((example) => (
                  <SelectItem key={example.id} value={example.id}>
                    {example.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-auto py-4">
            {isLoadingPrompt ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                placeholder="Digite seu prompt aqui..."
                className="min-h-[400px] resize-none font-mono text-sm bg-background/50"
              />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setEditPromptOpen(false)}
              disabled={isSavingPrompt}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePrompt}
              disabled={isSavingPrompt || isLoadingPrompt}
              className="gradient-primary hover:opacity-90 shadow-glow"
            >
              {isSavingPrompt ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Prompt'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
