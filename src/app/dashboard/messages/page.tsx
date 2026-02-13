'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
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
  ArrowLeft,
  X,
  Send,
  CheckCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Chat {
  id?: string;
  remoteJid?: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  /** @deprecated – not returned by Evolution API v2; use lastMessage.messageTimestamp */
  lastMsgTimestamp?: number | string | { low: number; high: number };
  /** @deprecated – not returned by Evolution API v2; use lastMessage.messageTimestamp */
  conversationTimestamp?: number | string | { low: number; high: number };
  /** ISO date string from Evolution API v2 */
  updatedAt?: string;
  unreadCount?: number;
  lastMessage?: any;
  /** All known JID variants for this chat (injected by backend dedup) */
  _allJids?: string[];
  instanceName: string;
  archived?: boolean;
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

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the raw phone-number digits from a JID.
 * Handles @lid format (`phone:deviceId@lid`) by stripping the `:deviceId`.
 */
function extractPhoneDigits(jid: string): string {
  const local = jid.split('@')[0] || '';
  // @lid JIDs have format phone:deviceId – strip the device part
  const colonIdx = local.indexOf(':');
  return colonIdx >= 0 ? local.slice(0, colonIdx) : local;
}

function getChatDisplayName(chat: Chat): string {
  if (chat.name && chat.name.trim()) return chat.name;
  if (chat.pushName && chat.pushName.trim()) return chat.pushName;
  const jid = chat.remoteJid || chat.id || '';
  const number = extractPhoneDigits(jid);
  if (number) {
    if (number.length > 8) {
      return `+${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4)}`;
    }
    return number;
  }
  return 'Desconhecido';
}

function getPhoneFromJid(chat: Chat): string {
  const jid = chat.remoteJid || chat.id || '';
  const number = extractPhoneDigits(jid);
  if (!number) return '';
  if (number.length > 8) {
    return `+${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4)}`;
  }
  return number;
}

function getInitials(name: string): string {
  if (name.startsWith('+')) return '#';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function isGroupChat(chat: Chat): boolean {
  const jid = chat.remoteJid || chat.id || '';
  return jid.endsWith('@g.us');
}

function isStatusBroadcast(chat: Chat): boolean {
  const jid = chat.remoteJid || chat.id || '';
  return jid === 'status@broadcast';
}

/**
 * Extracts the best-available timestamp from a chat object.
 *
 * Evolution API v2 returns the timestamp inside `lastMessage.messageTimestamp`
 * (unix seconds) and/or `updatedAt` (ISO date string).  Legacy fields
 * `lastMsgTimestamp` / `conversationTimestamp` are also checked as a fallback.
 */
function getChatTimestamp(
  chat: Chat,
): number | string | { low: number; high: number } | undefined {
  // Prefer the message-level timestamp
  const msgTs = chat.lastMessage?.messageTimestamp;
  if (msgTs) return msgTs;
  // Then updatedAt (ISO string → parse to unix seconds)
  if (chat.updatedAt) {
    const ms = new Date(chat.updatedAt).getTime();
    if (!isNaN(ms)) return Math.floor(ms / 1000);
  }
  // Legacy fallbacks
  return chat.lastMsgTimestamp || chat.conversationTimestamp;
}

function getLastMessagePreview(chat: Chat): { text: string; icon?: React.ReactNode } {
  const msg = chat.lastMessage;
  if (!msg) return { text: '' };
  const message = msg.message || msg;
  if (message.conversation) return { text: message.conversation };
  if (message.extendedTextMessage?.text) return { text: message.extendedTextMessage.text };
  if (message.imageMessage) return { text: message.imageMessage.caption || 'Foto', icon: <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.videoMessage) return { text: message.videoMessage.caption || 'Vídeo', icon: <Video className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.audioMessage) return { text: 'Áudio', icon: <Mic className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.documentMessage) return { text: message.documentMessage.fileName || 'Documento', icon: <FileText className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.locationMessage) return { text: 'Localização', icon: <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.contactMessage || message.contactsArrayMessage) return { text: 'Contato', icon: <Contact className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.stickerMessage) return { text: 'Sticker', icon: <Sticker className="h-3.5 w-3.5 flex-shrink-0" /> };
  if (message.reactionMessage) return { text: `${message.reactionMessage.text || ''} Reação` };
  if (message.pollCreationMessage || message.pollCreationMessageV3) return { text: 'Enquete' };
  if (message.listMessage) return { text: message.listMessage.title || 'Lista' };
  if (message.buttonsMessage || message.templateMessage) return { text: 'Mensagem interativa' };
  if (message.protocolMessage) {
    const type = message.protocolMessage.type;
    if (type === 0 || type === 'REVOKE') return { text: 'Mensagem apagada' };
    return { text: '' };
  }
  return { text: '' };
}

/**
 * Extracts readable text from a message object (used in the chat thread bubbles).
 */
function getMessageText(msg: any): { text: string; icon?: React.ReactNode } {
  const message = msg.message || msg;
  if (message.conversation) return { text: message.conversation };
  if (message.extendedTextMessage?.text) return { text: message.extendedTextMessage.text };
  if (message.imageMessage) return { text: message.imageMessage.caption || 'Foto', icon: <ImageIcon className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.videoMessage) return { text: message.videoMessage.caption || 'Vídeo', icon: <Video className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.audioMessage) return { text: 'Áudio', icon: <Mic className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.documentMessage) return { text: message.documentMessage.fileName || 'Documento', icon: <FileText className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.locationMessage) return { text: 'Localização', icon: <MapPin className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.contactMessage || message.contactsArrayMessage) return { text: 'Contato', icon: <Contact className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.stickerMessage) return { text: 'Sticker', icon: <Sticker className="h-4 w-4 flex-shrink-0 opacity-70" /> };
  if (message.reactionMessage) return { text: `${message.reactionMessage.text || ''} Reação` };
  if (message.pollCreationMessage || message.pollCreationMessageV3) return { text: 'Enquete' };
  if (message.listMessage) return { text: message.listMessage.title || 'Lista' };
  if (message.buttonsMessage || message.templateMessage) return { text: 'Mensagem interativa' };
  if (message.protocolMessage) {
    const type = message.protocolMessage.type;
    if (type === 0 || type === 'REVOKE') return { text: 'Mensagem apagada' };
    return { text: '' };
  }
  return { text: '' };
}

function normalizeTimestamp(ts: number | string | { low: number; high: number } | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && 'low' in ts) return ts.low * 1000;
  const num = typeof ts === 'number' ? ts : parseInt(String(ts), 10) || 0;
  if (num < 4102444800) return num * 1000;
  return num;
}

function formatTimestamp(ts: number | string | { low: number; high: number } | undefined): string {
  const ms = normalizeTimestamp(ts);
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatBubbleTime(ts: number | string | { low: number; high: number } | undefined): string {
  const ms = normalizeTimestamp(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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

function getInstanceDotColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const [data, setData] = useState<ChatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { token } = useAuthContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // AbortController ref to cancel stale message fetches when the user
  // switches to a different chat before the previous request completes.
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---- Data fetching ----

  const fetchChats = useCallback(async () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl || !token) return;
    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/messages/chats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json) setData(json);
      else console.error('Failed to fetch chats:', json);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }, [token]);

  const fetchMessages = useCallback(async (instanceName: string, remoteJid: string, allJids?: string[]) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl || !token) return;

    // Cancel any in-flight request for a previous chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingMessages(true);
    try {
      let url = `${backendUrl.replace(/\/$/, '')}/messages/${encodeURIComponent(instanceName)}/${encodeURIComponent(remoteJid)}`;
      // Pass all known JID variants (including @lid) so the backend can
      // query sent messages stored under alternate JID formats.
      if (allJids && allJids.length > 0) {
        const encoded = allJids.map((j) => encodeURIComponent(j)).join(',');
        url += `?allJids=${encoded}`;
      }
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });

      // If this request was aborted (user clicked another chat), bail out
      // silently – the newer request will handle state updates.
      if (controller.signal.aborted) return;

      const json = await response.json().catch(() => null);

      // Double-check after async .json() parse
      if (controller.signal.aborted) return;

      if (response.ok && json?.messages) {
        // Sort ascending by messageTimestamp (oldest first)
        const sorted = [...json.messages].sort((a: any, b: any) => {
          const tA = normalizeTimestamp(a.messageTimestamp || a.MessageTimestamp);
          const tB = normalizeTimestamp(b.messageTimestamp || b.MessageTimestamp);
          return tA - tB;
        });
        setMessages(sorted);
      } else {
        console.error('Failed to fetch messages:', json);
        setMessages([]);
      }
    } catch (error: any) {
      // Aborted fetches throw DOMException with name 'AbortError' – ignore them
      if (error?.name === 'AbortError') return;
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      // Only clear loading if this is still the active request
      if (!controller.signal.aborted) {
        setLoadingMessages(false);
      }
    }
  }, [token]);

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
    if (token) loadChats();
    else setLoading(false);
  }, [token]);

  // When selected chat changes, fetch its messages
  useEffect(() => {
    if (selectedChat) {
      const jid = selectedChat.remoteJid || selectedChat.id || '';
      if (jid) fetchMessages(selectedChat.instanceName, jid, selectedChat._allJids);
    } else {
      setMessages([]);
    }
  }, [selectedChat, fetchMessages]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  // ---- Derived data ----

  const filteredChats = useMemo(() => {
    if (!data?.chats) return [];
    return data.chats.filter((chat) => {
      if (isStatusBroadcast(chat)) return false;
      if (selectedInstance && chat.instanceName !== selectedInstance) return false;
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

  const instances = data?.instances || [];

  // ---- Handlers ----

  function handleSelectChat(chat: Chat) {
    setSelectedChat(chat);
  }

  function handleCloseChat() {
    setSelectedChat(null);
    setMessages([]);
  }

  // ---- Loading state ----

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

  const hasConnectedInstances = instances.some((i) => i.connected);

  // If no data or no connected instances, show empty states full-width
  if (!data || (!hasConnectedInstances && data)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20">
        <div className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
        </div>
      </div>
    );
  }

  // ---- Chat key for identifying the selected item ----
  const selectedChatKey = selectedChat
    ? `${selectedChat.instanceName}-${selectedChat.remoteJid || selectedChat.id}`
    : null;

  // =======================================================================
  // RENDER: Two-panel layout
  // =======================================================================

  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20 overflow-hidden">
      <div className="flex h-full">

        {/* ================================================================ */}
        {/* LEFT PANEL                                                       */}
        {/* ================================================================ */}
        <div
          className={cn(
            'flex flex-col border-r border-border/60 bg-card/30 backdrop-blur-sm',
            // Responsive: on mobile, hide left panel when chat is open
            selectedChat ? 'hidden lg:flex' : 'flex',
            'w-full lg:w-[380px] lg:min-w-[380px] lg:max-w-[380px]',
          )}
        >
          {/* Instance list */}
          <div className="flex-shrink-0 border-b border-border/50">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
                  <MessageCircle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-display font-bold text-foreground leading-tight">Mensagens</h1>
                  <p className="text-[11px] text-muted-foreground">
                    {data.connectedInstances}/{data.totalInstances} conectada{data.connectedInstances !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshChats}
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>

            {/* Instance filter buttons */}
            {instances.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedInstance(null)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 border',
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
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 border',
                      selectedInstance === inst.name
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:bg-secondary/80'
                    )}
                  >
                    {inst.connected ? (
                      <span className={cn('w-2 h-2 rounded-full', getInstanceDotColor(inst.name))} />
                    ) : (
                      <WifiOff className="h-3 w-3 text-destructive" />
                    )}
                    {inst.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex-shrink-0 px-3 py-2.5 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar conversas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Chat list */}
          <ScrollArea className="flex-1">
            {filteredChats.length > 0 ? (
              <div className="divide-y divide-border/40">
                {filteredChats.map((chat, index) => {
                  const displayName = getChatDisplayName(chat);
                  const initials = getInitials(displayName);
                  const isGroup = isGroupChat(chat);
                  const timestamp = formatTimestamp(getChatTimestamp(chat));
                  const { text: preview, icon: previewIcon } = getLastMessagePreview(chat);
                  const unread = chat.unreadCount || 0;
                  const chatKey = `${chat.instanceName}-${chat.remoteJid || chat.id || index}`;
                  const isSelected = chatKey === selectedChatKey;
                  const instanceColor = getInstanceColor(chat.instanceName);

                  return (
                    <button
                      key={chatKey}
                      onClick={() => handleSelectChat(chat)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 transition-colors duration-150 text-left',
                        isSelected
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-secondary/40 border-l-2 border-l-transparent',
                        unread > 0 && !isSelected && 'bg-primary/[0.03]'
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={cn(
                            'w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold',
                            isGroup ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isGroup ? <User className="h-5 w-5" /> : initials}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn('text-sm truncate', unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                              {displayName}
                            </span>
                            {instances.length > 1 && (
                              <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium flex-shrink-0', instanceColor)}>
                                {chat.instanceName}
                              </span>
                            )}
                          </div>
                          {timestamp && (
                            <span className={cn('text-[11px] flex-shrink-0', unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                              {timestamp}
                            </span>
                          )}
                        </div>
                        {preview && (
                          <div className="flex items-center gap-1">
                            {previewIcon && <span className="text-muted-foreground">{previewIcon}</span>}
                            <p className={cn('text-xs truncate', unread > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                              {preview}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : search.trim() ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
                <p className="text-xs text-muted-foreground mt-1">Tente uma busca diferente</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground mt-1">Aguardando mensagens...</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL                                                      */}
        {/* ================================================================ */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0',
            // Responsive: on mobile, hide right panel when no chat is selected
            selectedChat ? 'flex' : 'hidden lg:flex',
          )}
        >
          {selectedChat ? (
            <>
              {/* ---- Contact header ---- */}
              <div className="flex-shrink-0 h-16 border-b border-border/60 bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button (mobile only) */}
                  <button
                    onClick={handleCloseChat}
                    className="lg:hidden flex-shrink-0 p-1.5 -ml-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                  </button>

                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
                      isGroupChat(selectedChat) ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'
                    )}
                  >
                    {isGroupChat(selectedChat) ? <User className="h-5 w-5" /> : getInitials(getChatDisplayName(selectedChat))}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{getChatDisplayName(selectedChat)}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate">{getPhoneFromJid(selectedChat)}</p>
                      {instances.length > 1 && (
                        <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium', getInstanceColor(selectedChat.instanceName))}>
                          {selectedChat.instanceName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Close button (desktop) */}
                <button
                  onClick={handleCloseChat}
                  className="hidden lg:flex flex-shrink-0 p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* ---- Messages area ---- */}
              <div className="flex-1 overflow-y-auto bg-secondary/20 pattern-dots">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                      <p className="mt-3 text-sm text-muted-foreground">Carregando mensagens...</p>
                    </div>
                  </div>
                ) : messages.length > 0 ? (
                  <div className="px-4 sm:px-6 py-4 space-y-1">
                    {messages.map((msg, index) => {
                      const key = msg.key || {};
                      const fromMe = key.fromMe === true;
                      const { text, icon } = getMessageText(msg);
                      const bubbleTime = formatBubbleTime(msg.messageTimestamp || msg.MessageTimestamp);

                      // Skip empty / protocol messages
                      if (!text) return null;

                      return (
                        <div
                          key={key.id || index}
                          className={cn('flex', fromMe ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm',
                              fromMe
                                ? 'bg-primary/15 dark:bg-primary/20 rounded-br-md'
                                : 'bg-card border border-border/60 rounded-bl-md'
                            )}
                          >
                            {icon && <div className="mb-1">{icon}</div>}
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{text}</p>
                            <div className={cn('flex items-center gap-1 mt-1', fromMe ? 'justify-end' : 'justify-start')}>
                              <span className="text-[10px] text-muted-foreground">{bubbleTime}</span>
                              {fromMe && (
                                <CheckCheck className="h-3.5 w-3.5 text-primary/60" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center px-6">
                      <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Input area (placeholder) ---- */}
              <div className="flex-shrink-0 border-t border-border/60 bg-card/50 backdrop-blur-sm px-4 sm:px-6 py-3">
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    placeholder="Digite uma mensagem para enviar..."
                    disabled
                    className="flex-1 h-10 text-sm opacity-60"
                  />
                  <Button size="icon" disabled className="h-10 w-10 rounded-xl opacity-60">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
                  Envio de mensagens em breve
                </p>
              </div>
            </>
          ) : (
            /* ---- Empty state: no chat selected ---- */
            <div className="flex-1 flex items-center justify-center bg-secondary/10">
              <div className="text-center px-6 animate-fade-in">
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mx-auto mb-6">
                  <MessageCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-xl font-display font-bold text-foreground mb-2">
                  Selecione uma conversa
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Escolha uma conversa na lista à esquerda para visualizar as mensagens.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
