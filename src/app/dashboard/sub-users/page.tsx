'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';
import { SubUser, ParentInstance, SubUserPermission } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Users,
  Plus,
  Trash2,
  Shield,
  ArrowLeft,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SubUsersPage() {
  const router = useRouter();
  const { token, isPremium, isSubUser } = useAuthContext();
  const { toast } = useToast();

  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create sub-user dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SubUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions dialog
  const [permTarget, setPermTarget] = useState<SubUser | null>(null);
  const [parentInstances, setParentInstances] = useState<ParentInstance[]>([]);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Redirect if not premium or is sub-user
  useEffect(() => {
    if (!loading && (!isPremium || isSubUser)) {
      router.replace('/dashboard');
    }
  }, [isPremium, isSubUser, loading, router]);

  const fetchSubUsers = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/sub-users', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setSubUsers(data);
      }
    } catch (error) {
      console.error('Erro ao buscar sub-usuários:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSubUsers();
  }, [fetchSubUsers]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para criar o sub-usuário.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/sub-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Erro ao criar sub-usuário');
      }

      toast({
        title: 'Sub-usuário criado',
        description: `"${data.name}" foi criado com sucesso.`,
      });

      setIsCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '' });
      fetchSubUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível criar o sub-usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sub-users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao excluir sub-usuário');
      }

      toast({
        title: 'Sub-usuário excluído',
        description: `"${deleteTarget.name}" foi excluído com sucesso.`,
      });

      setDeleteTarget(null);
      fetchSubUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível excluir o sub-usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openPermissions = async (subUser: SubUser) => {
    setPermTarget(subUser);
    setIsLoadingPerms(true);
    setSelectedInstanceIds(new Set());

    try {
      // Fetch parent instances and current permissions in parallel
      const [instancesRes, permsRes] = await Promise.all([
        fetch('/api/sub-users/instances', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch(`/api/sub-users/${subUser.id}/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);

      const instances = await instancesRes.json();
      const perms: SubUserPermission[] = await permsRes.json();

      if (instancesRes.ok && Array.isArray(instances)) {
        setParentInstances(instances);
      }

      if (permsRes.ok && Array.isArray(perms)) {
        setSelectedInstanceIds(new Set(perms.map((p) => p.instanceId)));
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as permissões.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPerms(false);
    }
  };

  const toggleInstance = (instanceId: string) => {
    setSelectedInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!permTarget) return;
    setIsSavingPerms(true);
    try {
      const response = await fetch(`/api/sub-users/${permTarget.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instanceIds: Array.from(selectedInstanceIds) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao salvar permissões');
      }

      toast({
        title: 'Permissões salvas',
        description: `As permissões de "${permTarget.name}" foram atualizadas.`,
      });

      setPermTarget(null);
      fetchSubUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar as permissões.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPerms(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-ring">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">Carregando sub-usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="animate-fade-in">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/dashboard')}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                  Sub-Usuários
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie contas com acesso restrito às suas instâncias
                </p>
              </div>
            </div>
          </div>
          <div className="animate-slide-in-right">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-10 px-5 gradient-primary hover:opacity-90 shadow-glow transition-all"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Criar Sub-Usuário
            </Button>
          </div>
        </div>

        {/* Content */}
        {subUsers.length > 0 ? (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Sub-Usuários ({subUsers.length})
              </CardTitle>
              <CardDescription>
                Sub-usuários podem gerenciar apenas as instâncias que você permitir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Instâncias Permitidas</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subUsers.map((subUser) => (
                    <TableRow key={subUser.id}>
                      <TableCell className="font-medium">{subUser.name}</TableCell>
                      <TableCell className="text-muted-foreground">{subUser.email}</TableCell>
                      <TableCell>
                        <Badge variant={subUser.permissionCount > 0 ? 'default' : 'secondary'}>
                          {subUser.permissionCount} instância{subUser.permissionCount !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(subUser.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissions(subUser)}
                          >
                            <Shield className="mr-1.5 h-3.5 w-3.5" />
                            Permissões
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(subUser)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-card/50 backdrop-blur-sm">
              <div className="absolute inset-0 pattern-dots opacity-30" />
              <div className="relative flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  Nenhum sub-usuário criado
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm text-base">
                  Crie sub-usuários para permitir que outras pessoas gerenciem suas instâncias com acesso restrito.
                </p>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="gradient-primary hover:opacity-90 shadow-glow"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar Primeiro Sub-Usuário
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: Criar Sub-Usuário */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Criar Sub-Usuário
            </DialogTitle>
            <DialogDescription>
              Crie uma conta com acesso restrito. O sub-usuário poderá fazer login e gerenciar apenas as instâncias que você permitir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="sub-name" className="flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" />
                Nome
              </Label>
              <Input
                id="sub-name"
                placeholder="Nome do sub-usuário"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                className="h-11 bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email
              </Label>
              <Input
                id="sub-email"
                type="email"
                placeholder="email@exemplo.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="h-11 bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-password" className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Senha
              </Label>
              <Input
                id="sub-password"
                type="password"
                placeholder="Senha de acesso"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                className="h-11 bg-background/50"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="gradient-primary hover:opacity-90 shadow-glow"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Sub-Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar Permissões */}
      <Dialog open={!!permTarget} onOpenChange={(open) => !open && setPermTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões de {permTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Selecione quais instâncias este sub-usuário pode acessar e gerenciar.
            </DialogDescription>
          </DialogHeader>

          {isLoadingPerms ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : parentInstances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>Nenhuma instância encontrada no banco de dados.</p>
              <p className="text-sm mt-1">
                As instâncias precisam ter um prompt configurado para aparecerem aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {parentInstances.map((instance) => {
                const isSelected = selectedInstanceIds.has(instance.id);
                return (
                  <div
                    key={instance.id}
                    onClick={() => toggleInstance(instance.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-secondary/30'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleInstance(instance.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{instance.name}</p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="mt-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selectedInstanceIds.size} de {parentInstances.length} selecionada{parentInstances.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPermTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  disabled={isSavingPerms}
                  className="gradient-primary hover:opacity-90 shadow-glow"
                >
                  {isSavingPerms ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Permissões'
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog: Confirmar Exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sub-usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita. Todas as permissões serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
    </div>
  );
}
