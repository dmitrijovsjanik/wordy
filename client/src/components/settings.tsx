import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { BackButton } from '@/components/ui/back-button';
import { useThemeStore } from '@/stores/theme-store';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '\u{1F1F7}\u{1F1FA}', available: true },
  { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}', available: true },
  { code: 'es', name: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}', available: false },
  { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}', available: false },
  { code: 'fr', name: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}', available: false },
] as const;

type LanguageDropdownProps = {
  label: string;
  value: string;
  excludeCode: string;
};

function LanguageDropdown({ label, value, excludeCode }: LanguageDropdownProps) {
  const current = LANGUAGES.find((l) => l.code === value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[var(--gray-11)]">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-[var(--gray-3)] px-3 py-2 text-sm font-medium outline-none active:bg-[var(--gray-4)]"
          >
            <span>{current?.flag}</span>
            <span>{current?.name}</span>
            <span className="text-[var(--gray-11)]">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {LANGUAGES.filter((l) => l.code !== excludeCode).map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              disabled={!lang.available}
              className={cn(
                !lang.available && 'opacity-50',
                lang.code === value && 'text-[var(--brand-11)] font-medium',
              )}
            >
              <span>{lang.flag}</span>
              <span className="flex-1">{lang.name}</span>
              {!lang.available && (
                <Badge variant="secondary" className="text-[10px]">soon</Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const toggleRepeatMastered = useUserStore((s) => s.toggleRepeatMastered);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useBackButton(useCallback(() => navigate('/profile'), [navigate]));

  if (!user) return null;

  return (
    <div className="flex flex-col px-4 pt-4 pb-4">
      <div className="mb-4">
        <BackButton to="/profile" />
      </div>

      <h1 className="mb-4 text-xl font-bold">Настройки</h1>

      {/* Theme */}
      <Card>
        <span className="text-sm text-[var(--gray-11)]">Тема</span>
        <div className="mt-3 flex gap-2">
          {([
            { value: 'light' as const, label: 'Светлая' },
            { value: 'dark' as const, label: 'Тёмная' },
            { value: 'system' as const, label: 'Система' },
          ]).map((item) => (
            <Button
              key={item.value}
              variant={theme === item.value ? 'default' : 'secondary'}
              size="compact"
              onClick={() => setTheme(item.value)}
              className="flex-1"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Language */}
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Язык</span>
        <div className="mt-3 flex flex-col gap-2">
          <LanguageDropdown
            label="Родной"
            value={user.nativeLanguage}
            excludeCode={user.learningLanguage}
          />
          <LanguageDropdown
            label="Изучаю"
            value={user.learningLanguage}
            excludeCode={user.nativeLanguage}
          />
        </div>
      </Card>

      {/* Quiz Settings */}
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Квиз</span>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Повторять выученные слова</span>
            <span className="text-xs text-[var(--gray-11)]">Выученные слова будут возвращаться раз в 3 месяца</span>
          </div>
          <Switch
            checked={user.repeatMastered}
            onCheckedChange={() => toggleRepeatMastered()}
          />
        </div>
      </Card>
    </div>
  );
}
