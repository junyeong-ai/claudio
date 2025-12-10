'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard, SkeletonMessage, Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatNumber, formatDate } from '@/lib/utils';
import { staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { parseMrkdwn, type MrkdwnOptions } from '@/lib/mrkdwn';
import { useSlackContext } from './context';
import { getInitials, getAvatarColor, extractUserIdsFromMessages } from './utils';
import { Search, Users, Hash, MessageSquare, Clock, AlertCircle, ChevronDown, ChevronUp, Loader2, Lock, Globe, Mail, AtSign, Copy, Check, MessagesSquare } from 'lucide-react';
import { searchUsers, searchChannels, getChannelMembers, getChannelMessages, getThreadMessages, type SlackUser, type SlackChannel, type SlackMessage, type UsersResponse, type ChannelsResponse, type MembersResponse, type MessagesResponse } from './api';

type TabType = 'users' | 'channels' | 'messages';

const tabs: { id: TabType; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'channels', label: 'Channels', icon: Hash },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

function ExpandableText({ text, maxLength = 300, className }: { text: string; maxLength?: number; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getEmoji, showUserDetail, resolveUserName } = useSlackContext();
  const mrkdwnOptions: MrkdwnOptions = useMemo(() => ({ getEmoji, onUserClick: showUserDetail, resolveUser: resolveUserName }), [getEmoji, showUserDetail, resolveUserName]);
  const shouldTruncate = text.length > maxLength;
  const displayText = shouldTruncate && !isExpanded ? text.slice(0, maxLength) + '...' : text;

  return (
    <div className={className}>
      <div className="whitespace-pre-wrap break-words">{parseMrkdwn(displayText, mrkdwnOptions)}</div>
      {shouldTruncate && (
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
          {isExpanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
        </button>
      )}
    </div>
  );
}

function CopyableId({ id, label }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => { await navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono" title="Click to copy">
      {label && <span className="text-muted-foreground/70">{label}</span>}
      <span className="truncate max-w-32">{id}</span>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-50" />}
    </button>
  );
}

function ResultsHeader({ count, query, duration, label = 'results for' }: { count: number; query: string; duration: number; label?: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>Found <span className="font-medium text-foreground">{formatNumber(count)}</span> {label} &quot;{query}&quot;</span>
      <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{formatNumber(duration)}ms</span></div>
    </div>
  );
}

function LocalEmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <Card><CardContent className="py-12 text-center"><Icon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><p className="text-muted-foreground">{message}</p></CardContent></Card>
  );
}

function UserCard({ user }: { user: SlackUser }) {
  const { showUserDetail } = useSlackContext();
  const initials = getInitials(user.real_name || user.display_name || user.name);
  const avatarColor = getAvatarColor(user.id);

  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => showUserDetail(user.id)}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            {user.image_72 && <AvatarImage src={user.image_72} alt={user.name} />}
            <AvatarFallback className={cn(avatarColor, 'text-white font-medium')}>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{user.real_name || user.name}</span>
              {user.is_bot && <Badge variant="secondary" className="text-xs">Bot</Badge>}
              {user.deleted && <Badge variant="destructive" className="text-xs">Deleted</Badge>}
            </div>
            <div className="mt-1 space-y-1">
              {user.display_name && <div className="flex items-center gap-1 text-sm text-muted-foreground"><AtSign className="h-3 w-3" /><span>{user.display_name}</span></div>}
              {user.email && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{user.email}</span></div>}
              <CopyableId id={user.id} label="ID:" />
            </div>
            {user.status_text && <div className="text-sm text-muted-foreground mt-2 px-2 py-1 bg-muted rounded inline-block">{user.status_emoji} {user.status_text}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelCard({ channel, isExpanded, onToggle, members, isLoadingMembers }: { channel: SlackChannel; isExpanded: boolean; onToggle: () => void; members?: MembersResponse; isLoadingMembers: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {channel.is_private ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Hash className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{channel.name}</span>
              <Badge variant={channel.is_private ? 'secondary' : 'outline'} className="text-xs">
                {channel.is_private ? <><Lock className="h-3 w-3 mr-1" />Private</> : <><Globe className="h-3 w-3 mr-1" />Public</>}
              </Badge>
              {channel.is_archived && <Badge variant="destructive" className="text-xs">Archived</Badge>}
            </div>
            <CopyableId id={channel.id} label="ID:" />
            {(channel.purpose || channel.topic) && <ExpandableText text={channel.purpose || channel.topic || ''} maxLength={150} className="text-sm text-muted-foreground mt-2" />}
            <div className="flex items-center gap-3 mt-2">
              {channel.num_members !== undefined && <span className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{formatNumber(channel.num_members)} members</span>}
              <button onClick={onToggle} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                {isExpanded ? 'Hide members' : 'Show members'}
              </button>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-3 mt-3 border-t">
                    {isLoadingMembers ? (
                      <div className="flex gap-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-8 rounded-full" />)}</div>
                    ) : members ? (
                      <div className="flex flex-wrap gap-2">
                        {members.members.slice(0, 20).map((member) => <MemberChip key={member.id} member={member} />)}
                        {members.members.length > 20 && <span className="text-sm text-muted-foreground px-2 py-1">+{members.members.length - 20} more</span>}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReactionBadge({ name, count }: { name: string; count: number }) {
  const { getEmoji } = useSlackContext();
  const emoji = getEmoji(name);
  const isUrl = emoji?.startsWith('http://') || emoji?.startsWith('https://');
  return (
    <span className="text-xs bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- External Slack emoji CDN */}
      {emoji ? (isUrl ? <img src={emoji} alt={`:${name}:`} className="h-4 w-4" /> : <span>{emoji}</span>) : <span>:{name}:</span>}
      <span>{count}</span>
    </span>
  );
}

function MemberChip({ member }: { member: SlackUser }) {
  const { showUserDetail } = useSlackContext();
  const initials = getInitials(member.display_name || member.real_name || member.name);
  const avatarColor = getAvatarColor(member.id);
  const displayName = member.display_name || member.real_name || member.name;

  return (
    <button onClick={() => showUserDetail(member.id)} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-full text-sm hover:bg-muted/80 transition-colors" title={member.email ? `${displayName}\n${member.email}` : displayName}>
      <Avatar className="h-5 w-5">
        {member.image_48 && <AvatarImage src={member.image_48} alt={member.name} />}
        <AvatarFallback className={cn(avatarColor, 'text-white text-xs')}>{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate max-w-28">{displayName}</span>
    </button>
  );
}

function getMessageDisplayInfo(message: SlackMessage) {
  const isBot = !!message.bot_id;
  const displayName = message.user_name || message.user || (isBot ? 'Bot' : 'Unknown');
  const avatarKey = message.user || message.bot_id || message.ts;
  return { isBot, displayName, avatarKey };
}

function MessageCard({ message, onOpenThread }: { message: SlackMessage; onOpenThread?: () => void }) {
  const { showUserDetail } = useSlackContext();
  const ts = parseFloat(message.ts) * 1000;
  const { isBot, displayName, avatarKey } = getMessageDisplayInfo(message);
  const avatarColor = getAvatarColor(avatarKey);

  return (
    <Card className="overflow-hidden">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          {message.user ? (
            <button onClick={() => showUserDetail(message.user!)} className="shrink-0">
              <Avatar className="h-9 w-9 hover:ring-2 hover:ring-primary/50 transition-all">
                {message.user_image && <AvatarImage src={message.user_image} alt={displayName} />}
                <AvatarFallback className={cn(avatarColor, 'text-white text-xs')}>{getInitials(displayName)}</AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className={cn(avatarColor, 'text-white text-xs')}>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {message.user ? (
                <button onClick={() => showUserDetail(message.user!)} className="font-medium text-sm hover:underline">{displayName}</button>
              ) : (
                <span className="font-medium text-sm text-muted-foreground">
                  {displayName}
                  {isBot && <Badge variant="secondary" className="ml-2 text-[10px] py-0">Bot</Badge>}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatDate(ts, 'short')} {formatDate(ts, 'time')}</span>
              {onOpenThread && (
                <button onClick={onOpenThread} className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto">
                  <MessagesSquare className="h-3 w-3" />{message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
            <ExpandableText text={message.text} maxLength={400} className="text-sm" />
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">{message.reactions.map((reaction, i) => <ReactionBadge key={i} name={reaction.name} count={reaction.count} />)}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreadMessageCard({ message, isFirst }: { message: SlackMessage; isFirst: boolean }) {
  const { showUserDetail } = useSlackContext();
  const ts = parseFloat(message.ts) * 1000;
  const { displayName, avatarKey } = getMessageDisplayInfo(message);
  const avatarColor = getAvatarColor(avatarKey);

  return (
    <div className={cn('flex items-start gap-3 py-2', isFirst && 'pb-3 border-b')}>
      {message.user ? (
        <button onClick={() => showUserDetail(message.user!)} className="shrink-0">
          <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary/50 transition-all">
            {message.user_image && <AvatarImage src={message.user_image} alt={displayName} />}
            <AvatarFallback className={cn(avatarColor, 'text-white text-xs')}>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
        </button>
      ) : (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn(avatarColor, 'text-white text-xs')}>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {message.user ? (
            <button onClick={() => showUserDetail(message.user!)} className="font-medium text-sm hover:underline">{displayName}</button>
          ) : (
            <span className="font-medium text-sm text-muted-foreground">{displayName}</span>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(ts, 'time')}</span>
        </div>
        <ExpandableText text={message.text} maxLength={500} className="text-sm" />
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">{message.reactions.map((reaction, i) => <ReactionBadge key={i} name={reaction.name} count={reaction.count} />)}</div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton({ variant, count = 3 }: { variant: 'card' | 'message'; count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{variant === 'message' ? <SkeletonMessage /> : <SkeletonCard />}</div>
      ))}
    </div>
  );
}

export function SlackPage() {
  const { prefetchUsers } = useSlackContext();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usersResult, setUsersResult] = useState<UsersResponse | null>(null);
  const [channelsResult, setChannelsResult] = useState<ChannelsResponse | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [channelMembers, setChannelMembers] = useState<Record<string, MembersResponse>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [messagesResult, setMessagesResult] = useState<MessagesResponse | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [threadDialog, setThreadDialog] = useState<{ open: boolean; channel: string; ts: string; loading: boolean; messages: SlackMessage[]; error?: string }>({ open: false, channel: '', ts: '', loading: false, messages: [] });

  const handleSelectChannel = useCallback(async (channel: SlackChannel) => {
    setSelectedChannel(channel);
    setMessagesLoading(true);
    setMessagesResult(null);
    try {
      const data = await getChannelMessages(channel.id);
      const userIds = extractUserIdsFromMessages(data.messages);
      if (userIds.length > 0) await prefetchUsers(userIds);
      setMessagesResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [prefetchUsers]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setUsersResult(null);
    setChannelsResult(null);
    setMessagesResult(null);
    setSelectedChannel(null);

    try {
      if (activeTab === 'users') {
        setUsersResult(await searchUsers(query));
      } else if (activeTab === 'channels') {
        setChannelsResult(await searchChannels(query));
      } else if (activeTab === 'messages') {
        const data = await searchChannels(query);
        setChannelsResult(data);
        if (data.channels.length > 0) {
          await handleSelectChannel(data.channels[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [query, activeTab, handleSelectChannel]);

  const handleExpandChannel = async (channel: SlackChannel) => {
    if (expandedChannel === channel.id) { setExpandedChannel(null); return; }
    setExpandedChannel(channel.id);
    if (!channelMembers[channel.id]) {
      setLoadingMembers(channel.id);
      try {
        const data = await getChannelMembers(channel.id);
        setChannelMembers((prev) => ({ ...prev, [channel.id]: data }));
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setLoadingMembers(null);
      }
    }
  };

  const handleOpenThread = async (channel: string, ts: string) => {
    setThreadDialog({ open: true, channel, ts, loading: true, messages: [] });
    try {
      const data = await getThreadMessages(channel, ts);
      const userIds = extractUserIdsFromMessages(data.messages);
      if (userIds.length > 0) await prefetchUsers(userIds);
      setThreadDialog((prev) => ({ ...prev, loading: false, messages: data.messages }));
    } catch (err) {
      setThreadDialog((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to load thread' }));
    }
  };

  const placeholders = { users: 'Search by name or email...', channels: 'Search channels by name...', messages: 'Search channel to view messages...' };

  return (
    <div className="space-y-6">
      <PageHeader title="Slack" description="Search users, channels, and view messages" />

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" role="tablist" aria-label="Slack search tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all', activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={transitions.spring}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={placeholders[activeTab]} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSearch())} className="pl-9 text-base h-11" />
              </div>
              <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="h-11 px-6">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setError(null); handleSearch(); }}>
                    Try again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <LoadingSkeleton variant={activeTab === 'messages' ? 'message' : 'card'} />}

      {activeTab === 'users' && usersResult && !isLoading && (
        <div className="space-y-4">
          <ResultsHeader count={usersResult.users.length} query={usersResult.query} duration={usersResult.duration_ms} />
          {usersResult.users.length === 0 ? (
            <LocalEmptyState icon={Users} message="No users found" />
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-3 md:grid-cols-2">
              {usersResult.users.map((user) => (
                <motion.div key={user.id} variants={staggerItem}><UserCard user={user} /></motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'channels' && channelsResult && !isLoading && (
        <div className="space-y-4">
          <ResultsHeader count={channelsResult.channels.length} query={channelsResult.query} duration={channelsResult.duration_ms} />
          {channelsResult.channels.length === 0 ? (
            <LocalEmptyState icon={Hash} message="No channels found" />
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
              {channelsResult.channels.map((channel) => (
                <motion.div key={channel.id} variants={staggerItem}>
                  <ChannelCard channel={channel} isExpanded={expandedChannel === channel.id} onToggle={() => handleExpandChannel(channel)} members={channelMembers[channel.id]} isLoadingMembers={loadingMembers === channel.id} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'messages' && !isLoading && (
        <div className="space-y-4">
          {channelsResult && channelsResult.channels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {channelsResult.channels.map((channel) => (
                <Button key={channel.id} variant={selectedChannel?.id === channel.id ? 'default' : 'outline'} size="sm" onClick={() => handleSelectChannel(channel)}>
                  <Hash className="h-3 w-3 mr-1" />{channel.name}
                </Button>
              ))}
            </div>
          )}
          {messagesLoading && <LoadingSkeleton variant="message" count={5} />}
          {selectedChannel && messagesResult && !messagesLoading && (
            <>
              <ResultsHeader count={messagesResult.messages.length} query={selectedChannel.name} duration={messagesResult.duration_ms} label="messages in" />
              {messagesResult.messages.length === 0 ? (
                <LocalEmptyState icon={MessageSquare} message="No messages found" />
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                  {messagesResult.messages.map((message) => (
                    <motion.div key={message.ts} variants={staggerItem}>
                      <MessageCard message={message} onOpenThread={message.reply_count && message.reply_count > 0 ? () => handleOpenThread(selectedChannel.id, message.ts) : undefined} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      )}

      {!isLoading && !error && !messagesLoading && ((activeTab === 'users' && !usersResult) || (activeTab === 'channels' && !channelsResult) || (activeTab === 'messages' && !channelsResult)) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center"><Search className="h-8 w-8 text-muted-foreground/50" /></div>
              <p className="text-muted-foreground mb-1">{activeTab === 'messages' ? 'Search for a channel to view its messages' : `Enter a search query to find ${activeTab}`}</p>
              <p className="text-sm text-muted-foreground/70">Press Enter to search</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={threadDialog.open} onOpenChange={(open) => setThreadDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessagesSquare className="h-5 w-5" />Thread</DialogTitle>
            <DialogDescription className="sr-only">View thread messages</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {threadDialog.loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : threadDialog.error ? (
              <div className="flex items-center gap-2 text-destructive py-4"><AlertCircle className="h-5 w-5" /><span>{threadDialog.error}</span></div>
            ) : (
              threadDialog.messages.map((message, index) => <ThreadMessageCard key={message.ts} message={message} isFirst={index === 0} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
