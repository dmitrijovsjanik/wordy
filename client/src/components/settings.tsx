import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { BackButton } from '@/components/ui/back-button';
import { PremiumDrawer } from '@/components/ui/premium-drawer';
import { speakText, stopAudio } from '@/lib/tts';
import { PILOT_FEATURES } from '@/lib/pilot-config';
import { TTS_VOICES } from '@/config/tts-voices';
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

function VoiceSection() {
  const user = useUserStore((s) => s.user);
  const setTtsVoice = useUserStore((s) => s.setTtsVoice);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);

  if (!user) return null;

  const userIsPremium = user.premiumUntil !== null && new Date(user.premiumUntil) > new Date();

  const handlePreview = async (voiceId: string, previewText: string) => {
    if (previewingId) {
      stopAudio();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(voiceId);
    try {
      const audio = await speakText(previewText, 0.9, voiceId);
      audio.addEventListener('ended', () => setPreviewingId(null));
    } catch {
      setPreviewingId(null);
    }
  };

  const handleSelect = async (voiceId: string, isPremiumVoice: boolean) => {
    if (PILOT_FEATURES.payments && isPremiumVoice && !userIsPremium) {
      setPremiumOpen(true);
      return;
    }
    try {
      await setTtsVoice(voiceId);
    } catch {
      // fallback — shouldn't happen since we check premium above
    }
  };

  return (
    <>
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Озвучка</span>
        <div className="mt-3 flex flex-col gap-2">
          {TTS_VOICES.map((v) => {
            const isActive = user.ttsVoice === v.id;
            const isLocked = PILOT_FEATURES.payments && v.premium && !userIsPremium;
            const isPreviewing = previewingId === v.id;
            const genderLabel = v.gender === 'F' ? 'Жен.' : 'Муж.';
            const accentLabel = v.accent === 'GB' ? 'Брит.' : 'Амер.';

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => void handleSelect(v.id, v.premium)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:opacity-80',
                  isActive ? 'bg-[var(--brand-3)]' : 'bg-[var(--gray-2)]',
                )}
              >
                {/* Name + gender/accent */}
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{v.name}</span>
                  <span className="text-xs text-[var(--gray-10)]">{genderLabel} {accentLabel}</span>
                </div>

                {/* Preview button */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); void handlePreview(v.id, v.preview); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void handlePreview(v.id, v.preview); } }}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:bg-[var(--gray-4)]',
                    isPreviewing ? 'text-[var(--brand-9)]' : 'text-[var(--gray-11)]',
                  )}
                >
                  <HugeiconsIcon
                    icon={VolumeHighIcon}
                    size={16}
                    strokeWidth={2}
                    className={cn(isPreviewing && 'animate-pulse')}
                  />
                </div>

                {/* Active checkmark / PRO badge */}
                {isActive ? (
                  <div className="flex h-8 w-8 items-center justify-center">
                    <HugeiconsIcon icon={Tick01Icon} size={16} strokeWidth={2} className="text-[var(--brand-9)]" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center">
                    {isLocked && <Badge variant="secondary" className="text-[10px]">PRO</Badge>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <PremiumDrawer open={premiumOpen} onOpenChange={setPremiumOpen} limitType="voices" />
    </>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  if (!user) return null;

  return (
    <div className="flex flex-col px-4 pt-4 pb-4">
      <div className="mb-4">
        <BackButton to="/" />
      </div>

      <h1 className="mb-4 text-xl font-bold">Настройки</h1>

      {/* Language */}
      <Card>
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

      {/* Voice */}
      <VoiceSection />

      {/* Linked Accounts */}
      <LinkedAccountsSection />
    </div>
  );
}

function LinkedAccountsSection() {
  const user = useUserStore((s) => s.user);
  if (!user) return null;

  const hasTelegram = !!user.telegramId;
  const hasVk = !!user.vkId;

  return (
    <Card className="mt-4">
      <span className="text-sm text-[var(--gray-11)]">Привязанные аккаунты</span>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-xl bg-[var(--gray-2)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Telegram</span>
          </div>
          {hasTelegram ? (
            <Badge variant="secondary" className="text-[10px] text-[var(--green-11)] bg-[var(--green-3)]">
              Привязан
            </Badge>
          ) : (
            <span className="text-xs text-[var(--gray-10)]">Не привязан</span>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[var(--gray-2)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">ВКонтакте</span>
          </div>
          {hasVk ? (
            <Badge variant="secondary" className="text-[10px] text-[var(--green-11)] bg-[var(--green-3)]">
              Привязан
            </Badge>
          ) : (
            <span className="text-xs text-[var(--gray-10)]">Не привязан</span>
          )}
        </div>
      </div>

      {(!hasTelegram || !hasVk) && (
        <p className="mt-2 text-xs text-[var(--gray-10)]">
          {!hasTelegram
            ? 'Чтобы привязать Telegram, откройте Wordy в Telegram.'
            : 'Чтобы привязать VK, откройте Wordy в VK Mini Apps.'}
        </p>
      )}
    </Card>
  );
}
