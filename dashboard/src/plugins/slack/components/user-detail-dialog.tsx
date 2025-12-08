'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useSlackContextOptional } from '../context';
import { getInitials, getAvatarColor } from '../utils';
import type { SlackUser } from '../api';
import {
  Loader2,
  AlertCircle,
  Mail,
  AtSign,
  Copy,
  Check,
  Briefcase,
  Shield,
  Bot,
  MapPin,
} from 'lucide-react';

function CopyableId({ id, label }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      title="Click to copy"
    >
      {label && <span className="text-muted-foreground/70">{label}</span>}
      <span className="truncate max-w-32">{id}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

export function UserDetailDialog() {
  const ctx = useSlackContextOptional();
  const [user, setUser] = useState<SlackUser | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedUserId = ctx?.selectedUserId;
  const setSelectedUserId = ctx?.setSelectedUserId;
  const getUser = ctx?.getUser;
  const getEmoji = ctx?.getEmoji;

  const loadUser = useCallback(
    async (userId: string) => {
      if (!getUser) return;
      setLoading(true);
      const u = await getUser(userId);
      setUser(u);
      setLoading(false);
    },
    [getUser]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedUserId?.(null);
        setUser(null);
      } else if (selectedUserId && !user) {
        loadUser(selectedUserId);
      }
    },
    [selectedUserId, user, setSelectedUserId, loadUser]
  );

  const prevUserId = useMemo(() => user?.id, [user]);
  if (selectedUserId && selectedUserId !== prevUserId && !loading) {
    loadUser(selectedUserId);
  }

  if (!ctx) return null;

  const displayName =
    user?.display_name || user?.real_name || user?.name || 'Unknown';
  const avatarColor = getAvatarColor(selectedUserId || '');

  return (
    <Dialog open={!!selectedUserId} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {user.image_72 && (
                  <AvatarImage src={user.image_72} alt={displayName} />
                )}
                <AvatarFallback className={cn(avatarColor, 'text-white text-xl')}>
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{displayName}</h3>
                {user.real_name && user.display_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {user.real_name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {user.is_admin && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user.is_bot && (
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      Bot
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {user.status_text && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-lg">
                {user.status_emoji &&
                getEmoji?.(user.status_emoji.replace(/:/g, '')) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getEmoji(user.status_emoji.replace(/:/g, ''))!}
                    alt={user.status_emoji}
                    className="h-4 w-4"
                  />
                ) : user.status_emoji ? (
                  <span>{user.status_emoji}</span>
                ) : null}
                <span className="text-muted-foreground">{user.status_text}</span>
              </div>
            )}

            <div className="space-y-2 text-sm">
              {user.title && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{user.title}</span>
                </div>
              )}
              {user.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${user.email}`}
                    className="text-primary hover:underline"
                  >
                    {user.email}
                  </a>
                </div>
              )}
              {user.timezone && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{user.timezone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">
                  {user.name}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <CopyableId id={user.id} label="ID:" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>User not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
