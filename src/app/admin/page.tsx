'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Crown,
  Users,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Mail,
  Settings,
  Trash2,
} from 'lucide-react';
import { UserWithSubscription, SubscriptionTier } from '@/types';

export default function AdminPage() {
  const { token } = useAuthContext();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = async () => {
    setIsUpdating(true);
    await fetchUsers();
    setIsUpdating(false);
    toast({
      title: 'Atualizado',
      description: 'Lista de usuários atualizada.',
    });
  };

  const openEditDialog = (user: UserWithSubscription) => {
    setSelectedUser(user);
    setSelectedTier(user.subscription?.tier || 'free');
    setExpiresAt(
      user.subscription?.expiresAt
        ? new Date(user.subscription.expiresAt).toISOString().slice(0, 16)
        : ''
    );
    setEditDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!selectedUser || !token) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${selectedUser.id}/subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tier: selectedTier,
            expiresAt: expiresAt || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      toast({
        title: 'Sucesso',
        description: `Assinatura de ${selectedUser.name} atualizada para ${selectedTier.toUpperCase()}.`,
      });

      setEditDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar assinatura.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSubscription = async () => {
    if (!selectedUser || !token) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${selectedUser.id}/subscription`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke subscription');
      }

      toast({
        title: 'Sucesso',
        description: `Assinatura de ${selectedUser.name} foi revogada.`,
      });

      setEditDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao revogar assinatura.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTierBadge = (tier: SubscriptionTier | undefined) => {
    switch (tier) {
      case 'pro':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Crown className="mr-1 h-3 w-3" />
            PRO
          </Badge>
        );
      case 'enterprise':
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0">
            <ShieldCheck className="mr-1 h-3 w-3" />
            ENTERPRISE
          </Badge>
        );
      default:
        return <Badge variant="secondary">FREE</Badge>;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const premiumCount = users.filter((u) => u.subscription?.isPremium).length;
  const totalUsers = users.length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="animate-fade-in">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Administração
              </h1>
              <Badge variant="outline" className="border-primary text-primary">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Admin
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Gerencie usuários e assinaturas da plataforma
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isUpdating}
            variant="outline"
            className="h-10 px-4 border-border/60 hover:bg-secondary/80 transition-all"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="bg-card/80 backdrop-blur-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Usuários
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Premium
              </CardTitle>
              <Crown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{premiumCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Free
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers - premiumCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Usuários</CardTitle>
            <CardDescription>
              Gerencie as assinaturas dos usuários cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name}</span>
                          {getTierBadge(user.subscription?.tier)}
                          {user.role === 'admin' && (
                            <Badge variant="outline" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                          {user.subscription?.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expira: {formatDate(user.subscription.expiresAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                      className="h-9 px-3"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Gerenciar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Subscription Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Gerenciar Assinatura</DialogTitle>
            <DialogDescription>
              Atualize a assinatura de <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tier">Plano</Label>
              <Select
                value={selectedTier}
                onValueChange={(value: SubscriptionTier) => setSelectedTier(value)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Data de Expiração (opcional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para assinatura sem expiração.
              </p>
            </div>
          </div>
          <div className="flex justify-between gap-3">
            <Button
              variant="destructive"
              onClick={handleRevokeSubscription}
              disabled={isSaving || selectedUser?.subscription?.tier === 'free'}
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Revogar
            </Button>
            <Button
              onClick={handleSaveSubscription}
              disabled={isSaving}
              className="flex-1 gradient-primary hover:opacity-90"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Crown className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

