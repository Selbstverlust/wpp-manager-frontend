'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, LogOut, LayoutDashboard, ChevronDown, ShieldCheck, Users, MessagesSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';

const Logo = () => (
  <Link href="/" className="flex items-center gap-3 group" aria-label="Voltar para página inicial">
    <div className="relative p-2.5 gradient-primary rounded-xl shadow-glow transition-transform group-hover:scale-105">
      <MessageCircle className="h-5 w-5 text-white" />
    </div>
    <span className="hidden sm:inline-block font-display font-semibold text-lg text-foreground">
      WPP Manager
    </span>
  </Link>
);

const NavLink = ({ href, children, icon: Icon }: { href: string; children: React.ReactNode; icon?: any }) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} passHref>
      <Button 
        variant="ghost" 
        className={cn(
          'gap-2 text-muted-foreground transition-all duration-200 font-medium',
          isActive && 'text-foreground bg-secondary/80 shadow-sm'
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </Button>
    </Link>
  );
};

export function Header() {
  const { user, logout } = useAuth();
  const { isPremium, isSubUser } = useAuthContext();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 glass">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/" icon={LayoutDashboard}>Painel</NavLink>
            <NavLink href="/dashboard/messages" icon={MessagesSquare}>Mensagens</NavLink>
            {isPremium && !isSubUser && (
              <NavLink href="/dashboard/sub-users" icon={Users}>Sub-Usuários</NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink href="/admin" icon={ShieldCheck}>Admin</NavLink>
            )}
          </nav>
        </div>
        
        <nav className="flex items-center gap-2">
          {/* Nav mobile */}
          <div className="md:hidden flex items-center gap-1">
            <NavLink href="/" icon={LayoutDashboard}>Painel</NavLink>
            <NavLink href="/dashboard/messages" icon={MessagesSquare}>Mensagens</NavLink>
            {isPremium && !isSubUser && (
              <NavLink href="/dashboard/sub-users" icon={Users}>Sub-Usuários</NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink href="/admin" icon={ShieldCheck}>Admin</NavLink>
            )}
          </div>
          
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative gap-2 pl-2 pr-3 h-10 rounded-full hover:bg-secondary/80 transition-colors"
                >
                  <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 shadow-soft" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex flex-col space-y-1.5">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer p-3"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
