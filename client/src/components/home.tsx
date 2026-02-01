import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon, Sword01Icon, UserIcon, Fire02Icon } from '@hugeicons/core-free-icons';

function xpForLevel(level: number) {
  return (level - 1) * (level - 1) * 100;
}

export function Home() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return (
    <div className="flex min-h-screen flex-col px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Привет, {user.firstName}!</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge>Уровень {user.level}</Badge>
            {user.streakDays > 0 && (
              <Badge>
                <HugeiconsIcon icon={Fire02Icon} size={14} />
                {user.streakDays} дн.
              </Badge>
            )}
          </div>
        </div>
        <Button variant="secondary" size="icon" onClick={() => navigate('/profile')}>
          <HugeiconsIcon icon={UserIcon} size={20} />
        </Button>
      </div>

      {/* XP Progress */}
      <Card className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--gray-11)]">Опыт</span>
          <span className="font-medium">{user.xp} XP</span>
        </div>
        <Progress value={progressPercent} className="mt-2" />
        <div className="mt-1 flex justify-between text-xs text-[var(--gray-11)]">
          <span>Ур. {user.level}</span>
          <span>Ур. {user.level + 1}</span>
        </div>
      </Card>

      {/* Actions — pushed to thumb zone */}
      <div className="mt-auto flex flex-col gap-3">
        <Button onClick={() => navigate('/quiz')}>
          <HugeiconsIcon icon={BookOpen02Icon} size={20} />
          Начать квиз
        </Button>
        <Button variant="secondary" onClick={() => navigate('/duel/create')}>
          <HugeiconsIcon icon={Sword01Icon} size={20} />
          Дуэль
        </Button>
      </div>
    </div>
  );
}
