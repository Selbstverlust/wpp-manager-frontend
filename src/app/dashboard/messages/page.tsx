'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
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
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Tag,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Socket } from 'socket.io-client';
import { createMessagesRealtimeSocket, RealtimeEnvelope } from '@/lib/messages-realtime';

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

interface Category {
  id: string;
  name: string;
  color: string | null;
  position: number;
  userId: string;
}

interface ChatCategoryAssignment {
  id: string;
  categoryId: string;
  remoteJid: string;
  instanceName: string;
  userId: string;
  position?: number;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function extractPhoneDigits(jid: string): string {
  const local = jid.split('@')[0] || '';
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

function getChatTimestamp(
  chat: Chat,
): number | string | { low: number; high: number } | undefined {
  const msgTs = chat.lastMessage?.messageTimestamp;
  if (msgTs) return msgTs;
  if (chat.updatedAt) {
    const ms = new Date(chat.updatedAt).getTime();
    if (!isNaN(ms)) return Math.floor(ms / 1000);
  }
  return chat.lastMsgTimestamp || chat.conversationTimestamp;
}

const MESSAGE_WRAPPERS = [
  'deviceSentMessage',
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
  'editedMessage',
] as const;

function unwrapMessage(raw: any): any {
  let message = raw?.message ?? raw;
  if (!message || typeof message !== 'object') return message;
  let changed = true;
  while (changed) {
    changed = false;
    for (const wrapper of MESSAGE_WRAPPERS) {
      if (message[wrapper]?.message) {
        message = message[wrapper].message;
        changed = true;
        break;
      }
    }
  }
  return message;
}

function getLastMessagePreview(chat: Chat): { text: string; icon?: React.ReactNode } {
  const msg = chat.lastMessage;
  if (!msg) return { text: '' };
  const message = unwrapMessage(msg);
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

function getMessageText(msg: any): { text: string; icon?: React.ReactNode } {
  const message = unwrapMessage(msg);
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

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#6366f1',
  '#ec4899', '#14b8a6', '#84cc16', '#a855f7',
];

function getChatKey(chat: Chat): string {
  return `${chat.instanceName}::${chat.remoteJid || chat.id || ''}`;
}

function extractEventRemoteJid(payload: any): string {
  return (
    payload?.key?.remoteJid ||
    payload?.data?.key?.remoteJid ||
    payload?.message?.key?.remoteJid ||
    payload?.messages?.[0]?.key?.remoteJid ||
    payload?.chat?.remoteJid ||
    payload?.remoteJid ||
    ''
  );
}

function normalizeIncomingMessageRecord(payload: any): any {
  if (!payload) return null;
  if (payload.key && payload.message) return payload;
  if (payload.data?.key && payload.data?.message) return payload.data;
  if (payload.message?.key && payload.message?.message) return payload.message;
  if (Array.isArray(payload.messages) && payload.messages.length > 0) return payload.messages[0];
  return payload;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const [data, setData] = useState<ChatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const { token } = useAuthContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedChatRef = useRef<Chat | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // ---- Categories state ----
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<ChatCategoryAssignment[]>([]);
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());

  // ---- Category dialog state ----
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);

  // ---- Data fetching ----

  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

  const fetchChats = useCallback(async () => {
    if (!backendUrl || !token) return;
    try {
      const response = await fetch(`${backendUrl}/messages/chats`, {
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
  }, [token, backendUrl]);

  const fetchCategories = useCallback(async () => {
    if (!backendUrl || !token) return;
    try {
      const response = await fetch(`${backendUrl}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json().catch(() => null);
      if (response.ok && Array.isArray(json)) setCategories(json);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [token, backendUrl]);

  const fetchAssignments = useCallback(async () => {
    if (!backendUrl || !token) return;
    try {
      const response = await fetch(`${backendUrl}/categories/assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json().catch(() => null);
      if (response.ok && Array.isArray(json)) setAssignments(json);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  }, [token, backendUrl]);

  const fetchMessages = useCallback(async (instanceName: string, remoteJid: string, allJids?: string[]) => {
    if (!backendUrl || !token) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoadingMessages(true);
    try {
      let url = `${backendUrl}/messages/${encodeURIComponent(instanceName)}/${encodeURIComponent(remoteJid)}`;
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
      if (controller.signal.aborted) return;
      const json = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (response.ok && json?.messages) {
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
      if (error?.name === 'AbortError') return;
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMessages(false);
      }
    }
  }, [token, backendUrl]);

  const applyRealtimeMessage = useCallback((eventType: string, payload: any, instanceName: string) => {
    const selected = selectedChatRef.current;
    const normalizedMessage = normalizeIncomingMessageRecord(payload);
    if (!normalizedMessage) return;
    const eventJid = extractEventRemoteJid(normalizedMessage);
    const selectedJid = selected?.remoteJid || selected?.id || '';
    const selectedAllJids = selected?._allJids || [];
    const belongsToSelected =
      !!selected &&
      selected.instanceName === instanceName &&
      !!eventJid &&
      (eventJid === selectedJid || selectedAllJids.includes(eventJid));

    if (belongsToSelected) {
      if (eventType === 'MESSAGES_DELETE') {
        const deleteId = normalizedMessage.key?.id || normalizedMessage.id;
        if (deleteId) {
          setMessages((prev) =>
            prev.filter((m) => (m.key?.id || m.id) !== deleteId),
          );
        }
      } else {
        setMessages((prev) => {
          const incomingId = normalizedMessage.key?.id || normalizedMessage.id;
          if (incomingId) {
            const idx = prev.findIndex((m) => (m.key?.id || m.id) === incomingId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...prev[idx], ...normalizedMessage };
              return next;
            }
          }
          const next = [...prev, normalizedMessage];
          next.sort((a, b) => {
            const tA = normalizeTimestamp(a.messageTimestamp || a.MessageTimestamp);
            const tB = normalizeTimestamp(b.messageTimestamp || b.MessageTimestamp);
            return tA - tB;
          });
          return next;
        });
      }
    }

    if (!eventJid) return;
    setData((prev) => {
      if (!prev) return prev;
      const idx = prev.chats.findIndex(
        (chat) =>
          chat.instanceName === instanceName &&
          (chat.remoteJid === eventJid || chat.id === eventJid || chat._allJids?.includes(eventJid)),
      );
      if (idx < 0) return prev;
      const nextChats = [...prev.chats];
      const existing = nextChats[idx];
      const unreadDelta = normalizedMessage?.key?.fromMe ? 0 : 1;
      nextChats[idx] = {
        ...existing,
        remoteJid: existing.remoteJid || eventJid,
        lastMessage: normalizedMessage,
        updatedAt: new Date().toISOString(),
        unreadCount: eventType === 'MESSAGES_DELETE'
          ? Math.max((existing.unreadCount || 0) - unreadDelta, 0)
          : (existing.unreadCount || 0) + unreadDelta,
      };
      nextChats.sort((a, b) => normalizeTimestamp(getChatTimestamp(b)) - normalizeTimestamp(getChatTimestamp(a)));
      return { ...prev, chats: nextChats };
    });
  }, []);

  const applyRealtimeChat = useCallback((eventType: string, payload: any, instanceName: string) => {
    const rawChat = payload?.chat || payload?.data || payload;
    const remoteJid = rawChat?.remoteJid || rawChat?.id || extractEventRemoteJid(payload);
    if (!remoteJid) return;
    setData((prev) => {
      if (!prev) return prev;
      const nextChats = [...prev.chats];
      const idx = nextChats.findIndex(
        (chat) =>
          chat.instanceName === instanceName &&
          (chat.remoteJid === remoteJid || chat.id === remoteJid || chat._allJids?.includes(remoteJid)),
      );

      if (eventType === 'CHATS_DELETE') {
        if (idx >= 0) nextChats.splice(idx, 1);
        return { ...prev, chats: nextChats };
      }

      const merged = {
        ...(idx >= 0 ? nextChats[idx] : {}),
        ...(rawChat || {}),
        instanceName,
        remoteJid,
      };
      if (idx >= 0) nextChats[idx] = merged;
      else nextChats.push(merged);
      nextChats.sort((a, b) => normalizeTimestamp(getChatTimestamp(b)) - normalizeTimestamp(getChatTimestamp(a)));
      return { ...prev, chats: nextChats };
    });
  }, []);

  async function loadChats() {
    setLoading(true);
    await Promise.all([fetchChats(), fetchCategories(), fetchAssignments()]);
    setLoading(false);
  }

  async function refreshChats() {
    setRefreshing(true);
    await Promise.all([fetchChats(), fetchCategories(), fetchAssignments()]);
    setRefreshing(false);
  }

  const sendMessage = useCallback(async () => {
    if (!backendUrl || !token || !selectedChat || !messageInput.trim()) return;
    const jid = selectedChat.remoteJid || selectedChat.id || '';
    if (!jid) return;
    const number = jid.split('@')[0] || '';
    if (!number) return;
    setSending(true);
    try {
      const url = `${backendUrl}/messages/${encodeURIComponent(selectedChat.instanceName)}/send-text`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ number, text: messageInput.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json) {
        setMessageInput('');
        setMessages((prev) => [
          ...prev,
          {
            key: json.key || {},
            message: json.message || {},
            messageTimestamp: json.messageTimestamp || String(Math.floor(Date.now() / 1000)),
            status: json.status || 'PENDING',
          },
        ]);
      } else {
        console.error('Failed to send message:', json);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [token, backendUrl, selectedChat, messageInput]);

  // ---- Category CRUD ----

  async function createCategory() {
    if (!backendUrl || !token || !categoryName.trim()) return;
    try {
      const response = await fetch(`${backendUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: categoryName.trim(), color: categoryColor }),
      });
      if (response.ok) {
        const created = await response.json();
        setCategories((prev) => [...prev, created]);
        setCategoryDialogOpen(false);
        setCategoryName('');
        setCategoryColor(CATEGORY_COLORS[0]);
      }
    } catch (error) {
      console.error('Error creating category:', error);
    }
  }

  async function updateCategory() {
    if (!backendUrl || !token || !editingCategory || !categoryName.trim()) return;
    try {
      const response = await fetch(`${backendUrl}/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: categoryName.trim(), color: categoryColor }),
      });
      if (response.ok) {
        const updated = await response.json();
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setCategoryDialogOpen(false);
        setEditingCategory(null);
        setCategoryName('');
        setCategoryColor(CATEGORY_COLORS[0]);
      }
    } catch (error) {
      console.error('Error updating category:', error);
    }
  }

  async function deleteCategory(id: string) {
    if (!backendUrl || !token) return;
    try {
      const response = await fetch(`${backendUrl}/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok || response.status === 204) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setAssignments((prev) => prev.filter((a) => a.categoryId !== id));
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  async function assignChatToCategory(chat: Chat, categoryId: string) {
    if (!backendUrl || !token) return;
    const remoteJid = chat.remoteJid || chat.id || '';
    try {
      const response = await fetch(`${backendUrl}/categories/${categoryId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remoteJid, instanceName: chat.instanceName }),
      });
      if (response.ok) {
        const created = await response.json();
        // Remove any old assignment for this chat, then add new one
        setAssignments((prev) => [
          ...prev.filter((a) => !(a.remoteJid === remoteJid && a.instanceName === chat.instanceName)),
          created,
        ]);
      }
    } catch (error) {
      console.error('Error assigning chat:', error);
    }
  }

  async function unassignChat(chat: Chat) {
    if (!backendUrl || !token) return;
    const remoteJid = chat.remoteJid || chat.id || '';
    // Find the assignment to get the category ID
    const assignment = assignments.find(
      (a) => a.remoteJid === remoteJid && a.instanceName === chat.instanceName,
    );
    if (!assignment) return;
    try {
      const response = await fetch(`${backendUrl}/categories/${assignment.categoryId}/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remoteJid, instanceName: chat.instanceName }),
      });
      if (response.ok || response.status === 204) {
        setAssignments((prev) =>
          prev.filter((a) => !(a.remoteJid === remoteJid && a.instanceName === chat.instanceName)),
        );
      }
    } catch (error) {
      console.error('Error unassigning chat:', error);
    }
  }

  // ---- Effects ----

  useEffect(() => {
    if (token) loadChats();
    else setLoading(false);
  }, [token]);

  useEffect(() => {
    if (selectedChat) {
      const jid = selectedChat.remoteJid || selectedChat.id || '';
      if (jid) fetchMessages(selectedChat.instanceName, jid, selectedChat._allJids);
    } else {
      setMessages([]);
    }
  }, [selectedChat, fetchMessages]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  useEffect(() => {
    if (!backendUrl || !token) return;
    const socket = createMessagesRealtimeSocket(backendUrl, token);
    socketRef.current = socket;

    socket.on('messages:event', (envelope: RealtimeEnvelope) => {
      const eventType = envelope?.event || '';
      const instanceName = envelope?.instanceName || '';
      if (!eventType || !instanceName) return;

      if (eventType === 'CONNECTION_UPDATE') {
        const isConnected = String(
          envelope.payload?.state || envelope.payload?.connection || envelope.payload?.status || '',
        ).toLowerCase() === 'open';
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            instances: prev.instances.map((inst) =>
              inst.name === instanceName ? { ...inst, connected: isConnected } : inst,
            ),
          };
        });
        return;
      }

      if (
        eventType === 'MESSAGES_UPSERT' ||
        eventType === 'MESSAGES_UPDATE' ||
        eventType === 'MESSAGES_DELETE' ||
        eventType === 'SEND_MESSAGE'
      ) {
        applyRealtimeMessage(eventType, envelope.payload, instanceName);
        return;
      }

      if (
        eventType === 'CHATS_UPSERT' ||
        eventType === 'CHATS_UPDATE' ||
        eventType === 'CHATS_DELETE'
      ) {
        applyRealtimeChat(eventType, envelope.payload, instanceName);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendUrl, token, applyRealtimeMessage, applyRealtimeChat]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !data?.instances?.length) return;
    const connectedNames = data.instances.filter((inst) => inst.connected).map((inst) => inst.name);
    socket.emit('messages:watch-instances', { instances: connectedNames });
  }, [data?.instances]);

  // Auto-expand all instances on first load
  useEffect(() => {
    if (data?.instances) {
      const connected = data.instances.filter((i) => i.connected).map((i) => i.name);
      setExpandedInstances(new Set(connected));
    }
  }, [data?.instances]);

  // ---- Derived data ----

  const instances = data?.instances || [];

  /** Build assignment lookup: "instanceName::remoteJid" → categoryId */
  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      map.set(`${a.instanceName}::${a.remoteJid}`, a.categoryId);
    }
    return map;
  }, [assignments]);

  /** Full assignment lookup for position sorting */
  const assignmentFullMap = useMemo(() => {
    const map = new Map<string, ChatCategoryAssignment>();
    for (const a of assignments) {
      map.set(`${a.instanceName}::${a.remoteJid}`, a);
    }
    return map;
  }, [assignments]);

  /** All chats filtered by search, excluding groups/broadcasts */
  const filteredChats = useMemo(() => {
    if (!data?.chats) return [];
    return data.chats.filter((chat) => {
      if (isGroupChat(chat)) return false;
      if (isStatusBroadcast(chat)) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const name = getChatDisplayName(chat).toLowerCase();
        const jid = (chat.remoteJid || chat.id || '').toLowerCase();
        const preview = getLastMessagePreview(chat).text.toLowerCase();
        if (!name.includes(query) && !jid.includes(query) && !preview.includes(query)) return false;
      }
      return true;
    });
  }, [data?.chats, search]);

  /** Chats grouped by instance that are NOT assigned to any category */
  const unsortedChatsByInstance = useMemo(() => {
    const map = new Map<string, Chat[]>();
    for (const inst of instances) {
      if (inst.connected) map.set(inst.name, []);
    }
    for (const chat of filteredChats) {
      const key = getChatKey(chat);
      if (assignmentMap.has(key)) continue; // assigned to a category
      const arr = map.get(chat.instanceName) || [];
      arr.push(chat);
      map.set(chat.instanceName, arr);
    }
    return map;
  }, [filteredChats, instances, assignmentMap]);

  /** Chats without category, sorted by timestamp */
  const unsortedChats = useMemo(() => {
    const list: Chat[] = [];
    for (const chat of filteredChats) {
      if (!assignmentMap.has(getChatKey(chat))) {
        list.push(chat);
      }
    }
    return list.sort((a, b) => normalizeTimestamp(getChatTimestamp(b)) - normalizeTimestamp(getChatTimestamp(a)));
  }, [filteredChats, assignmentMap]);

  /** Chats grouped by category */
  const chatsByCategory = useMemo(() => {
    const map = new Map<string, Chat[]>();
    for (const cat of categories) {
      map.set(cat.id, []);
    }
    for (const chat of filteredChats) {
      const key = getChatKey(chat);
      const catId = assignmentMap.get(key);
      if (catId && map.has(catId)) {
        map.get(catId)!.push(chat);
      }
    }
    // Sort each category's chats by their assigned position
    for (const [catId, arr] of map.entries()) {
      arr.sort((a, b) => {
        const keyA = getChatKey(a);
        const keyB = getChatKey(b);
        const posA = assignmentFullMap.get(keyA)?.position ?? 0;
        const posB = assignmentFullMap.get(keyB)?.position ?? 0;
        return posA - posB;
      });
    }
    return map;
  }, [filteredChats, categories, assignmentMap, assignmentFullMap]);

  // ---- Handlers ----

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const separatorIdx = draggableId.indexOf('::');
    if (separatorIdx === -1) return;
    const instanceName = draggableId.slice(0, separatorIdx);
    const remoteJid = draggableId.slice(separatorIdx + 2);

    const isSourceCategory = source.droppableId.startsWith('cat-');
    const isDestCategory = destination.droppableId.startsWith('cat-');

    if (source.droppableId === destination.droppableId) {
      // Reordering within the same column
      if (isDestCategory) {
        const catId = destination.droppableId.replace('cat-', '');
        const currentChats = Array.from(chatsByCategory.get(catId) || []);
        
        // Optimitically update UI
        const [moved] = currentChats.splice(source.index, 1);
        currentChats.splice(destination.index, 0, moved);

        const newAssignments = [...assignments];
        currentChats.forEach((chat, i) => {
          const key = getChatKey(chat);
          const idx = newAssignments.findIndex(a => `${a.instanceName}::${a.remoteJid}` === key);
          if (idx !== -1) {
            newAssignments[idx].position = i;
          }
        });
        setAssignments(newAssignments);

        // Sync to backend
        const payload = currentChats.map(c => ({
          remoteJid: c.remoteJid || c.id || '',
          instanceName: c.instanceName,
        }));
        
        fetch(`${backendUrl}/categories/${catId}/reorder-chats`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chats: payload })
        }).catch(console.error);
      }
      return;
    }

    // Moving across different columns
    const chatToMove = filteredChats.find(c => getChatKey(c) === draggableId);
    if (!chatToMove) return;

    if (isDestCategory) {
      const newCatId = destination.droppableId.replace('cat-', '');
      const newCatChats = Array.from(chatsByCategory.get(newCatId) || []);
      
      // Optimistically insert
      newCatChats.splice(destination.index, 0, chatToMove);

      const updatedAssignments = [...assignments.filter(a => `${a.instanceName}::${a.remoteJid}` !== draggableId)];
      
      // We push a mock assignment for optimistic update
      newCatChats.forEach((chat, i) => {
         const key = getChatKey(chat);
         const existing = updatedAssignments.find(a => `${a.instanceName}::${a.remoteJid}` === key);
         if (existing) {
           existing.position = i;
         } else if (key === draggableId) {
           updatedAssignments.push({
             id: 'temp-' + Date.now(),
             categoryId: newCatId,
             remoteJid,
             instanceName,
             userId: '',
             position: i
           });
         }
      });
      setAssignments(updatedAssignments);

      // Backend Calls: 1) Assign 2) Reorder
      try {
         await fetch(`${backendUrl}/categories/${newCatId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ remoteJid, instanceName }),
         });
         const payload = newCatChats.map(c => ({
           remoteJid: c.remoteJid || c.id || '',
           instanceName: c.instanceName,
         }));
         await fetch(`${backendUrl}/categories/${newCatId}/reorder-chats`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ chats: payload })
         });
         fetchAssignments(); // Re-fetch to get real IDs
      } catch(e) { console.error(e) }
    } else {
      // Dropped into an unsorted instance list or unassigned column (unassign)
      const oldAssignment = assignments.find(a => `${a.instanceName}::${a.remoteJid}` === draggableId);
      const newAssignments = assignments.filter(a => `${a.instanceName}::${a.remoteJid}` !== draggableId);
      setAssignments(newAssignments);
      
      if (oldAssignment) {
        fetch(`${backendUrl}/categories/${oldAssignment.categoryId}/assign`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ remoteJid, instanceName }),
        }).catch(console.error);
      }
    }
  };

  function handleSelectChat(chat: Chat) {
    setSelectedChat(chat);
    setMessageInput('');
  }

  function handleCloseChat() {
    setSelectedChat(null);
    setMessages([]);
    setMessageInput('');
  }

  function toggleInstance(name: string) {
    setExpandedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function openCreateCategoryDialog() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor(CATEGORY_COLORS[0]);
    setCategoryDialogOpen(true);
  }

  function openEditCategoryDialog(cat: Category) {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryColor(cat.color || CATEGORY_COLORS[0]);
    setCategoryDialogOpen(true);
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

  const selectedChatKey = selectedChat ? getChatKey(selectedChat) : null;

  // ---- Chat card component (reused in both instance list and category columns) ----

  function renderChatCard(chat: Chat, index: number) {
    const displayName = getChatDisplayName(chat);
    const initials = getInitials(displayName);
    const timestamp = formatTimestamp(getChatTimestamp(chat));
    const { text: preview, icon: previewIcon } = getLastMessagePreview(chat);
    const unread = chat.unreadCount || 0;
    const chatKey = getChatKey(chat);
    const isSelected = chatKey === selectedChatKey;
    const assignedCategoryId = assignmentMap.get(chatKey);

    return (
      <Draggable draggableId={chatKey} index={index} key={chatKey}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn('pb-1.5 focus:outline-none focus-visible:ring-0', snapshot.isDragging && 'opacity-90 z-50')}
          >
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="relative group block w-full">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectChat(chat)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectChat(chat);
                      }
                    }}
                    className={cn(
                      'w-full rounded-lg border p-2.5 text-left transition-all duration-150 outline-none cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/20'
                        : 'bg-card border-border/50 hover:border-border hover:shadow-sm',
                      unread > 0 && !isSelected && 'border-primary/20 bg-primary/[0.03]'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-semibold bg-primary/10 text-primary">
                          {initials}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center shadow-sm">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={cn('text-xs truncate', unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                            {displayName}
                          </span>
                          {timestamp && (
                            <span className={cn('text-[10px] flex-shrink-0', unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                              {timestamp}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {previewIcon && <span className="text-muted-foreground">{previewIcon}</span>}
                          {preview && (
                            <p className={cn('text-[11px] truncate leading-snug flex-1', unread > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                              {preview}
                            </p>
                          )}
                          {/* Instance badge in category view */}
                          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium flex-shrink-0 ml-auto', getInstanceColor(chat.instanceName))}>
                            {chat.instanceName}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-48">
                {categories.length > 0 && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Tag className="h-3.5 w-3.5 mr-2" />
                      Mover para categoria
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      {categories.map((cat) => (
                        <ContextMenuItem
                          key={cat.id}
                          onClick={() => assignChatToCategory(chat, cat.id)}
                          className={cn(assignedCategoryId === cat.id && 'bg-primary/10')}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: cat.color || '#6366f1' }}
                          />
                          {cat.name}
                          {assignedCategoryId === cat.id && (
                            <Check className="h-3.5 w-3.5 ml-auto text-primary" />
                          )}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
                {assignedCategoryId && (
                  <ContextMenuItem onClick={() => unassignChat(chat)}>
                    <X className="h-3.5 w-3.5 mr-2" />
                    Remover da categoria
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        )}
      </Draggable>
    );
  }

  // =======================================================================
  // RENDER
  // =======================================================================

  if (!isMounted) return null;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20 overflow-hidden">
        <div className="flex h-full">

        {/* ================================================================ */}
        {/* LEFT PANEL – Instances (vertical) + Category Columns             */}
        {/* ================================================================ */}
        <div
          className={cn(
            'flex flex-col border-r border-border/60 bg-card',
            selectedChat ? 'hidden lg:flex' : 'flex',
            'w-full lg:w-1/2 lg:min-w-0',
          )}
        >
          {/* Top bar: title + search + refresh + add category */}
          <div className="flex-shrink-0 border-b border-border/50">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-shrink-0">
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
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar conversas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshChats}
                  disabled={refreshing}
                  className="h-9 w-9 flex-shrink-0"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable content: instances + categories */}
          <div className="flex-1 overflow-hidden flex flex-row">

            {/* ---- Instance rows (thin left column) ---- */}
            <div className="w-[300px] flex-shrink-0 flex flex-col overflow-y-auto border-r border-border/40 bg-card/10">
              <div className="px-3 pt-3 pb-1 sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border/40 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Instâncias
                  </span>
                </div>
              </div>

              {Array.from(unsortedChatsByInstance.entries()).map(([instanceName, chats]) => {
                const isExpanded = expandedInstances.has(instanceName);
                const dotColor = getInstanceDotColor(instanceName);

                return (
                  <div key={instanceName} className="mx-3 mb-2">
                    {/* Instance header row */}
                    <button
                      onClick={() => toggleInstance(instanceName)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/40 hover:bg-secondary/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dotColor)} />
                      <span className="text-sm font-semibold text-foreground truncate">{instanceName}</span>
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 flex-shrink-0 ml-auto">
                        {chats.length}
                      </span>
                    </button>

                    {/* Expanded chat list */}
                    {isExpanded && (
                      <Droppable droppableId={`inst-${instanceName}`}>
                        {(provided, snapshot) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn('mt-1.5 min-h-[50px] pl-2', snapshot.isDraggingOver && 'bg-primary/5 rounded-b-lg')}
                          >
                            {chats.length > 0 ? (
                              chats.map((chat, index) => renderChatCard(chat, index))
                            ) : (
                              <div className="flex items-center justify-center py-4 px-2 text-center pointer-events-none">
                                <p className="text-[11px] text-muted-foreground">
                                  {search.trim() ? 'Nenhum resultado' : 'Todas as conversas estão categorizadas'}
                                </p>
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                );
              })}

              {unsortedChatsByInstance.size === 0 && (
                <div className="flex items-center justify-center py-4">
                  <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
                </div>
              )}
            </div>

            {/* ---- Category columns (horizontal scroll) ---- */}
            <div className="flex-1 overflow-hidden flex flex-col bg-secondary/10">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0 border-b border-border/40 bg-background/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Categorias
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openCreateCategoryDialog}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova
                </Button>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-3 p-3 h-full min-w-max">
                  {categories.map((cat) => {
                    const chats = chatsByCategory.get(cat.id) || [];

                    return (
                      <div
                        key={cat.id}
                        className="w-[280px] flex-shrink-0 flex flex-col rounded-xl bg-secondary/30 border border-border/50"
                      >
                        {/* Category column header */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color || '#6366f1' }}
                            />
                            <span className="text-sm font-semibold text-foreground truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5">
                              {chats.length}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded-md hover:bg-secondary/80 transition-colors">
                                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => openEditCategoryDialog(cat)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteCategory(cat.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Category body — scrollable chat cards */}
                        <ScrollArea className="flex-1">
                          <Droppable droppableId={`cat-${cat.id}`}>
                            {(provided, snapshot) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className={cn('p-2 min-h-[200px] h-full', snapshot.isDraggingOver && 'bg-primary/5')}
                              >
                                {chats.length > 0 ? (
                                  chats.map((chat, index) => renderChatCard(chat, index))
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-8 px-2 text-center pointer-events-none">
                                    <FolderOpen className="h-6 w-6 text-muted-foreground/30 mb-2" />
                                    <p className="text-[11px] text-muted-foreground">
                                      {search.trim() ? 'Nenhum resultado' : 'Arraste conversas para cá'}
                                    </p>
                                  </div>
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </ScrollArea>
                      </div>
                    );
                  })}

                  {categories.length === 0 && (
                    <div className="flex items-center justify-center w-full">
                      <div className="text-center px-6">
                        <FolderOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">Nenhuma categoria criada</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openCreateCategoryDialog}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Criar categoria
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL – Chat conversation                                  */}
        {/* ================================================================ */}
        <div
          className={cn(
            'flex flex-col min-w-0',
            selectedChat ? 'flex' : 'hidden lg:flex',
            'w-full lg:w-1/2',
          )}
        >
          {selectedChat ? (
            <>
              {/* ---- Contact header ---- */}
              <div className="flex-shrink-0 h-16 border-b border-border/60 bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={handleCloseChat}
                    className="lg:hidden flex-shrink-0 p-1.5 -ml-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                  </button>

                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-primary/10 text-primary"
                  >
                    {getInitials(getChatDisplayName(selectedChat))}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{getChatDisplayName(selectedChat)}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate">{getPhoneFromJid(selectedChat)}</p>
                      <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium', getInstanceColor(selectedChat.instanceName))}>
                        {selectedChat.instanceName}
                      </span>
                    </div>
                  </div>
                </div>

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

              {/* ---- Input area ---- */}
              <div className="flex-shrink-0 border-t border-border/60 bg-card/50 backdrop-blur-sm px-4 sm:px-6 py-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex items-center gap-3"
                >
                  <Input
                    type="text"
                    placeholder="Digite uma mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={sending}
                    className="flex-1 h-10 text-sm"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sending || !messageInput.trim()}
                    className="h-10 w-10 rounded-xl"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-secondary/10">
              <div className="text-center px-6 animate-fade-in">
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mx-auto mb-6">
                  <MessageCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-xl font-display font-bold text-foreground mb-2">
                  Selecione uma conversa
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Escolha uma conversa no painel à esquerda para visualizar as mensagens.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Category create/edit dialog                                       */}
      {/* ================================================================ */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Clientes VIP"
                className="h-9"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    editingCategory ? updateCategory() : createCategory();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCategoryColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      categoryColor === color && 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={editingCategory ? updateCategory : createCategory}
              disabled={!categoryName.trim()}
            >
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </DragDropContext>
  );
}
