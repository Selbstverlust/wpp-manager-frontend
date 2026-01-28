'use client';

import type { Instance, InstanceStatus } from '@/lib/data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Settings, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<InstanceStatus, { icon: React.ReactNode; label: string; className: string }> = {
  connected: {
    icon: <CheckCircle2 className="h-4 w-4 text-success" />,
    label: 'Connected',
    className: 'bg-success/10 text-success border-success/20',
  },
  pending: {
    icon: <Clock className="h-4 w-4 text-warning" />,
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  disconnected: {
    icon: <XCircle className="h-4 w-4 text-destructive" />,
    label: 'Disconnected',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export function InstanceCard({ instance }: { instance: Instance }) {
  const { toast } = useToast();

  const handleDisconnect = () => {
    // Here you would typically call an API to disconnect
    toast({
      title: 'Instance Disconnected',
      description: `"${instance.name}" has been disconnected.`,
      variant: 'destructive'
    });
  };
  
  const StatusBadge = () => {
    const config = statusConfig[instance.status];
    return (
      <Badge variant="outline" className={`gap-1.5 font-medium ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <Card className="flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:hover:shadow-primary/10">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">{instance.name}</CardTitle>
          <StatusBadge />
        </div>
        <CardDescription>
          Created {formatDistanceToNow(new Date(instance.createdAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">
            Instance ID: <span className="font-mono text-xs bg-muted p-1 rounded-md">{instance.id}</span>
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 bg-muted/50 py-3 px-6 -m-6 mt-6 rounded-b-lg">
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Manage
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will disconnect the "{instance.name}" instance. You will need to reconnect it to resume service.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDisconnect}
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
