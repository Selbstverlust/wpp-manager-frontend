export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  isPremium: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  parentUserId?: string | null;
}

export interface UserWithSubscription extends User {
  subscription: Subscription | null;
}

export interface SubUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  permissionCount: number;
}

export interface SubUserPermission {
  instanceId: string;
  instanceName: string | null;
}

export interface ParentInstance {
  id: string;
  name: string;
}
