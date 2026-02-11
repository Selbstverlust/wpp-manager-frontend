'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle,
  Search,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  User,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  MapPin,
  Contact,
  Sticker,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Chat {
  id?: string;
  remoteJid?: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  lastMsgTimestamp?: number | string | { low: number; high: number };
  conversationTimestamp?: number | string | { low: number; high: number };
  unreadCount?: number;
  lastMessage?: any;
  instanceName: string;
  archived?: boolean;
  // labels / extra data
  [key: string]: any;
}

interface InstanceStatus {
  name: string;
  connected: boolean;
}

interface ChatsResponse {
  chats: Chat[];
  instances: InstanceStatus[];
  totalInstances: number;
  connectedInstances: number;
}

/**
 * Extracts a human-readable name from a chat object.
 */
function getChatDisplayName(chat: Chat): string {
  if (chat.name && chat.name.trim()) return chat.name;
  if (chat.pushName && chat.pushName.trim()) return chat.pushName;
  // Fall back to phone number from the JID
  const jid = chat.remoteJid || chat.id || '';
  const number = jid.split('@')[0];
  if (number) {
    // Format phone number for readability
    if (number.length > 8) {
      return `+${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4)}`;
    }
    return number;
  }
  return 'Desconhecido';
}

/**
 * Gets the initials from a display name for the avatar fallback.
 */
function getInitials(name: string): string {
  if (name.startsWith('+')) return '#';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Checks if a JID represents a group chat.
 */
function isGroupChat(chat: Chat): boolean {
  const jid = chat.remoteJid || chat.id || '';
  return jid.endsWith('@g.us');
}

/**
 * Checks if a JID represents a status broadcast.
 */
function isStatusBroadcast(chat: Chat): boolean {
  const jid = chat.remoteJid || chat.id || '';
  return jid === 'status@broadcast';
}

/**
 * Extracts a readable preview of the last message content.
 */
function getLastMessagePreview(chat: Chat): { text: string; icon?: React.ReactNode } {
  const msg = chat.lastMessage;
  if (!msg) return { text: '' };

  // The Evolution API may nest message content in different fields
  const message = msg.message || msg;

  if (message.conversation) {
    return { text: message.conversation };
  }
  if (message.extendedTextMessage?.text) {
    return { text: message.extendedTextMessage.text };
  }
  if (message.imageMessage) {
    return {
      text: message.imageMessage.caption || 'Foto',
      icon: <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.videoMessage) {
    return {
      text: message.videoMessage.caption || 'Vídeo',
      icon: <Video className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.audioMessage) {
    return {
      text: 'Áudio',
      icon: <Mic className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.documentMessage) {
    return {
      text: message.documentMessage.fileName || 'Documento',
      icon: <FileText className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.locationMessage) {
    return {
      text: 'Localização',
      icon: <MapPin className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.contactMessage || message.contactsArrayMessage) {
    return {
      text: 'Contato',
      icon: <Contact className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.stickerMessage) {
    return {
      text: 'Sticker',
      icon: <Sticker className="h-3.5 w-3.5 flex-shrink-0" />,
    };
  }
  if (message.reactionMessage) {
    return { text: `${message.reactionMessage.text || ''} Reação` };
  }
  if (message.pollCreationMessage || message.pollCreationMessageV3) {
    return { text: 'Enquete' };
  }
  if (message.listMessage) {
    return { text: message.listMessage.title || 'Lista' };
  }
  if (message.buttonsMessage || message.templateMessage) {
    return { text: 'Mensagem interativa' };
  }
  if (message.protocolMessage) {
    const type = message.protocolMessage.type;
    if (type === 0 || type === 'REVOKE') return { text: 'Mensagem apagada' };
    return { text: '' };
  }

  return { text: '' };
}

/**
 * Normalizes various timestamp formats from Evolution API v2 into milliseconds.
 */
function normalizeTimestamp(ts: number | string | { low: number; high: number } | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && 'low' in ts) {
    // Protobuf Long object
    return ts.low * 1000;
  }
  const num = typeof ts === 'number' ? ts : parseInt(String(ts), 10) || 0;
  // If the timestamp is in seconds (< year 2100 in seconds), convert to ms
  if (num < 4102444800) {
    return num * 1000;
  }
  return num;
}

/**
 * Formats a timestamp into a relative or absolute date string.
 */
function formatTimestamp(ts: number | string | { low: number; high: number } | undefined): string {
  const ms = normalizeTimestamp(ts);
  if (!ms) return '';

  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Ontem';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Generates a consistent color for an instance badge.
 */
function getInstanceColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function MessagesPage() {
  const [data, setData] = useState<ChatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const { token } = useAuthContext();

  async function fetchChats() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl || !token) return;

    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/messages/chats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const json = await response.json().catch(() => null);
      if (response.ok && json) {
        setData(json);
      } else {
        console.error('Failed to fetch chats:', json);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }

  async function loadChats() {
    setLoading(true);
    await fetchChats();
    setLoading(false);
  }

  async function refreshChats() {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  }

  useEffect(() => {
    if (token) {
      loadChats();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Filter and sort chats
  const filteredChats = useMemo(() => {
    if (!data?.chats) return [];

    return data.chats.filter((chat) => {
      // Exclude status broadcasts
      if (isStatusBroadcast(chat)) return false;

      // Filter by selected instance
      if (selectedInstance && chat.instanceName !== selectedInstance) return false;

      // Filter by search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const name = getChatDisplayName(chat).toLowerCase();
        const jid = (chat.remoteJid || chat.id || '').toLowerCase();
        const preview = getLastMessagePreview(chat).text.toLowerCase();
        return name.includes(query) || jid.includes(query) || preview.includes(query);
      }

      return true;
    });
  }, [data?.chats, search, selectedInstance]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-ring">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  const instances = data?.instances || [];
  const hasConnectedInstances = instances.some((i) => i.connected);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">Mensagens</h1>
                <p className="text-sm text-muted-foreground">
                  {data ? (
                    <>
                      {data.connectedInstances} de {data.totalInstances} instância{data.totalInstances !== 1 ? 's' : ''} conectada{data.connectedInstances !== 1 ? 's' : ''}
                      {filteredChats.length > 0 && (
                        <span className="ml-1">
                          &middot; {filteredChats.length} conversa{filteredChats.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  ) : (
                    'Carregue suas conversas recentes'
                  )}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshChats}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          {/* Instance filter pills + search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar conversas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Instance filter pills */}
          {instances.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedInstance(null)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border',
                  selectedInstance === null
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:bg-secondary/80'
                )}
              >
                Todas
              </button>
              {instances.map((inst) => (
                <button
                  key={inst.name}
                  onClick={() => setSelectedInstance(selectedInstance === inst.name ? null : inst.name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border',
                    selectedInstance === inst.name
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-secondary/80'
                  )}
                >
                  {inst.connected ? (
                    <Wifi className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-destructive" />
                  )}
                  {inst.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat list */}
        {filteredChats.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden shadow-soft animate-fade-in-up">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="divide-y divide-border/50">
                {filteredChats.map((chat, index) => {
                  const displayName = getChatDisplayName(chat);
                  const initials = getInitials(displayName);
                  const isGroup = isGroupChat(chat);
                  const timestamp = formatTimestamp(chat.lastMsgTimestamp || chat.conversationTimestamp);
                  const { text: preview, icon: previewIcon } = getLastMessagePreview(chat);
                  const unread = chat.unreadCount || 0;
                  const instanceColor = getInstanceColor(chat.instanceName);

                  return (
                    <div
                      key={`${chat.instanceName}-${chat.remoteJid || chat.id || index}`}
                      className={cn(
                        'flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors duration-150 hover:bg-secondary/40 cursor-default',
                        unread > 0 && 'bg-primary/[0.03]'
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold',
                            isGroup
                              ? 'bg-secondary text-secondary-foreground'
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isGroup ? (
                            <User className="h-5 w-5" />
                          ) : (
                            initials
                          )}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>

                      {/* Chat info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'text-sm truncate',
                                unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                              )}
                            >
                              {displayName}
                            </span>
                            {instances.length > 1 && (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0',
                                  instanceColor
                                )}
                              >
                                {chat.instanceName}
                              </span>
                            )}
                          </div>
                          {timestamp && (
                            <span
                              className={cn(
                                'text-xs flex-shrink-0',
                                unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'
                              )}
                            >
                              {timestamp}
                            </span>
                          )}
                        </div>
                        {preview && (
                          <div className="flex items-center gap-1.5">
                            {previewIcon && (
                              <span className="text-muted-foreground">{previewIcon}</span>
                            )}
                            <p
                              className={cn(
                                'text-xs truncate max-w-[85%]',
                                unread > 0 ? 'text-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {preview}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : !hasConnectedInstances && data ? (
          /* No connected instances */
          <div className="mt-8 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-card/50 backdrop-blur-sm">
              <div className="absolute inset-0 pattern-dots opacity-30" />
              <div className="relative flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                  <WifiOff className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  Nenhuma instância conectada
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm text-base">
                  Conecte pelo menos uma instância do WhatsApp no painel para visualizar suas mensagens.
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span>Vá ao Painel e conecte uma instância</span>
                </div>
              </div>
            </div>
          </div>
        ) : data && filteredChats.length === 0 && search.trim() ? (
          /* No results for search */
          <div className="mt-8 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-card/50 backdrop-blur-sm">
              <div className="absolute inset-0 pattern-dots opacity-30" />
              <div className="relative flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  Nenhum resultado
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm text-base">
                  Não encontramos conversas para &quot;{search}&quot;. Tente uma busca diferente.
                </p>
              </div>
            </div>
          </div>
        ) : data ? (
          /* No chats at all */
          <div className="mt-8 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-card/50 backdrop-blur-sm">
              <div className="absolute inset-0 pattern-dots opacity-30" />
              <div className="relative flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
                  <MessageCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  Nenhuma conversa ainda
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm text-base">
                  Suas conversas do WhatsApp aparecerão aqui assim que suas instâncias receberem mensagens.
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Aguardando mensagens...</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
