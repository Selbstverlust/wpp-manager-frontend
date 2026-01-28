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
}

export interface UserWithSubscription extends User {
  subscription: Subscription | null;
}
