import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Share01Icon,
  Cancel01Icon,
  Tick01Icon,
  UserGroupIcon,
  Fire02Icon,
  UserAdd01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { useFriendStore } from '@/stores/friend-store';
import { useBackButton } from '@/hooks/use-back-button';
import { telegram } from '@/lib/telegram';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';
import type { FriendInfo, FriendRequestInfo, LeagueTier } from '@/types/api';

const LEAGUE_NAMES: Record<LeagueTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
  amber: 'Янтарь',
  sapphire: 'Сапфир',
  amethyst: 'Аметист',
  topaz: 'Топаз',
  ruby: 'Рубин',
  legend: 'Легенда',
};

type FriendsTabType = 'friends' | 'requests';

export function Friends() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<FriendsTabType>('friends');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deepLinkResult, setDeepLinkResult] = useState<string | null>(null);

  const {
    friends,
    requests,
    requestCount,
    friendCode,
    inviteToken,
    isLoading,
    fetchFriends,
    fetchRequests,
    fetchFriendCode,
    fetchInviteToken,
  } = useFriendStore();

  useBackButton(useCallback(() => navigate('/profile'), [navigate]));

  useEffect(() => {
    fetchFriends();
    fetchRequests();
    fetchFriendCode();
    fetchInviteToken();
  }, [fetchFriends, fetchRequests, fetchFriendCode, fetchInviteToken]);

  // Deep link result from DeepLinkHandler
  useEffect(() => {
    const state = location.state as { deepLink?: string } | null;
    if (state?.deepLink) {
      setDeepLinkResult(state.deepLink);
      // Очищаем state чтобы модалка не показывалась повторно при навигации
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Share link → friend request (requires confirmation)
  const shareLink = friendCode
    ? `https://t.me/wordylang_bot/app?startapp=friend_${friendCode}`
    : null;

  // QR code → instant add (no confirmation)
  const qrLink = inviteToken
    ? `https://t.me/wordylang_bot/app?startapp=invite_${inviteToken}`
    : null;

  const handleShare = useCallback(() => {
    if (!shareLink) return;
    telegram.hapticImpact('light');

    if (navigator.share) {
      navigator.share({
        text: 'Добавь меня в друзья в Wordy!',
        url: shareLink,
      });
    } else {
      navigator.clipboard.writeText(shareLink);
    }
  }, [shareLink]);

  if (isLoading && friends.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
        <BackButton to="/profile" />
        <Skeleton className="h-14 w-full rounded-full" />
        <Skeleton className="h-14 w-full rounded-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex items-center gap-3">
        <BackButton to="/profile" />
        <Tabs className="flex-1">
          <TabsList>
            <TabsTrigger active={tab === 'friends'} onClick={() => setTab('friends')}>
              Друзья{friends.length > 0 ? ` (${friends.length})` : ''}
            </TabsTrigger>
            <TabsTrigger active={tab === 'requests'} onClick={() => setTab('requests')}>
              Запросы{requestCount > 0 ? ` (${requestCount})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1">
        {tab === 'friends' ? (
          <FriendsContent friends={friends} onInvite={() => setInviteOpen(true)} />
        ) : (
          <RequestsTab requests={requests} />
        )}
      </div>

      {/* Sticky bottom */}
      <div className="pointer-events-none sticky bottom-0 -mx-4">
        <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
          <Button className="w-full" onClick={() => setInviteOpen(true)}>
            <HugeiconsIcon icon={UserAdd01Icon} size={20} strokeWidth={2} />
            Добавить друга
          </Button>
        </div>
      </div>

      {/* Invite drawer */}
      <Drawer open={inviteOpen} onOpenChange={setInviteOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Пригласить друга</DrawerTitle>
            <DrawerDescription>
              Поделитесь ссылкой или покажите QR-код
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col items-center gap-4 px-4 pt-4 pb-8">
            {qrLink && (
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={qrLink} size={200} />
              </div>
            )}
            <Button className="w-full" disabled={!shareLink} onClick={handleShare}>
              <HugeiconsIcon icon={Share01Icon} size={20} strokeWidth={2} />
              Поделиться ссылкой
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setInviteOpen(false)}>
              Закрыть
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Deep link result drawer */}
      <Drawer open={deepLinkResult !== null} onOpenChange={(open) => { if (!open) setDeepLinkResult(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {deepLinkResult === 'friend_success' && 'Запрос отправлен'}
              {deepLinkResult === 'invite_success' && 'Друг добавлен'}
              {deepLinkResult === 'friend_error' && 'Не удалось отправить'}
              {deepLinkResult === 'invite_error' && 'Не удалось добавить'}
            </DrawerTitle>
            <DrawerDescription>
              {deepLinkResult === 'friend_success' && 'Запрос на дружбу успешно отправлен. Ожидайте подтверждения.'}
              {deepLinkResult === 'invite_success' && 'Вы успешно добавлены в друзья!'}
              {deepLinkResult === 'friend_error' && 'Возможно, вы уже отправляли запрос или являетесь друзьями.'}
              {deepLinkResult === 'invite_error' && 'Ссылка недействительна или уже была использована.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col items-center gap-4 px-4 pt-2 pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gray-3)]">
              <HugeiconsIcon
                icon={deepLinkResult?.includes('success') ? Tick01Icon : Cancel01Icon}
                size={32}
                strokeWidth={2}
                className={deepLinkResult?.includes('success') ? 'text-[var(--green-9)]' : 'text-[var(--red-9)]'}
              />
            </div>
            <Button className="w-full" onClick={() => setDeepLinkResult(null)}>
              Понятно
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ─── Friends Content ─────────────────────────────────────────────────────────

function FriendsContent({ friends, onInvite }: { friends: FriendInfo[]; onInvite: () => void }) {
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <HugeiconsIcon icon={UserGroupIcon} size={40} strokeWidth={1.5} className="text-[var(--gray-9)]" />
        <p className="text-sm text-[var(--gray-11)]">
          У вас пока нет друзей
        </p>
        <Button variant="secondary" size="compact" onClick={onInvite}>
          Пригласить
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {friends.map((friend) => (
        <FriendCard key={friend.id} friend={friend} />
      ))}
    </div>
  );
}

// ─── Friend Card ────────────────────────────────────────────────────────────

function FriendCard({ friend }: { friend: FriendInfo }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeFriend = useFriendStore((s) => s.removeFriend);

  const handleRemove = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    telegram.hapticImpact('medium');
    removeFriend(friend.id);
  }, [confirmDelete, friend.id, removeFriend]);

  const LeagueIcon = friend.league ? LEAGUE_ICONS[friend.league.tier] : null;

  return (
    <Card className="flex items-center gap-3">
      <Avatar
        src={friend.avatarUrl}
        fallback={friend.firstName}
        size={44}
      />

      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{friend.firstName}</span>
          <Badge variant="secondary" className="text-[10px]">
            Ур. {friend.level}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--gray-11)]">
          {LeagueIcon && (
            <span className="flex items-center gap-0.5">
              <LeagueIcon size={14} />
              {LEAGUE_NAMES[friend.league!.tier]}
            </span>
          )}
          {friend.streakDays > 0 && (
            <span className="flex items-center gap-0.5">
              <HugeiconsIcon icon={Fire02Icon} size={12} strokeWidth={2} className="text-[var(--amber-9)]" />
              {friend.streakDays}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleRemove}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-11)] active:bg-[var(--gray-4)]"
      >
        <HugeiconsIcon
          icon={confirmDelete ? Cancel01Icon : Delete02Icon}
          size={18}
          strokeWidth={2}
          className={confirmDelete ? 'text-[var(--red-9)]' : ''}
        />
      </button>
    </Card>
  );
}

// ─── Requests Tab ───────────────────────────────────────────────────────────

function RequestsTab({ requests }: { requests: FriendRequestInfo[] }) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-sm text-[var(--gray-11)]">
          Нет входящих запросов
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((request) => (
        <FriendRequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

// ─── Friend Request Card ────────────────────────────────────────────────────

function FriendRequestCard({ request }: { request: FriendRequestInfo }) {
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const declineRequest = useFriendStore((s) => s.declineRequest);

  const handleAccept = useCallback(() => {
    telegram.hapticNotification('success');
    acceptRequest(request.id);
  }, [request.id, acceptRequest]);

  const handleDecline = useCallback(() => {
    telegram.hapticImpact('light');
    declineRequest(request.id);
  }, [request.id, declineRequest]);

  return (
    <Card className="flex items-center gap-3">
      <Avatar
        src={request.fromUser.avatarUrl}
        fallback={request.fromUser.firstName}
        size={44}
      />

      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{request.fromUser.firstName}</span>
        <span className="text-xs text-[var(--gray-11)]">
          Уровень {request.fromUser.level}
        </span>
      </div>

      <div className="flex gap-1.5">
        <Button size="icon" variant="success" onClick={handleAccept}>
          <HugeiconsIcon icon={Tick01Icon} size={20} strokeWidth={2} />
        </Button>
        <Button size="icon" variant="secondary" onClick={handleDecline}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
        </Button>
      </div>
    </Card>
  );
}
