import { currentPlatform, type Platform } from './platform';
import { telegram } from './telegram';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

export interface PlatformBridge {
  readonly platform: Platform;

  /** Auth data для отправки на сервер */
  getInitData(): string | null;
  /** Deep link parameter */
  getStartParam(): string | null;

  // Lifecycle
  expand(): void;
  requestFullscreen(): void;
  disableVerticalSwipes(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;

  // Haptics
  hapticImpact(style: HapticStyle): void;
  hapticNotification(type: HapticNotification): void;

  // Native buttons — VK не имеет, в хуках проверяется наличие
  readonly hasNativeBackButton: boolean;
  readonly hasNativeMainButton: boolean;
}

// ─── Telegram ──────────────────────────────────────────────────────────────

const telegramBridge: PlatformBridge = {
  platform: 'telegram',

  getInitData() {
    return telegram.initData;
  },

  getStartParam() {
    return telegram.startParam;
  },

  expand() { telegram.expand(); },
  requestFullscreen() { telegram.requestFullscreen(); },
  disableVerticalSwipes() { telegram.disableVerticalSwipes(); },
  enableClosingConfirmation() { telegram.enableClosingConfirmation(); },
  disableClosingConfirmation() { telegram.disableClosingConfirmation(); },

  hapticImpact(style: HapticStyle) { telegram.hapticImpact(style); },
  hapticNotification(type: HapticNotification) { telegram.hapticNotification(type); },

  hasNativeBackButton: true,
  hasNativeMainButton: true,
};

// ─── VK ────────────────────────────────────────────────────────────────────

let vkBridgeModule: typeof import('@vkontakte/vk-bridge') | null = null;

async function getVkBridge() {
  if (!vkBridgeModule) {
    vkBridgeModule = await import('@vkontakte/vk-bridge');
  }
  return vkBridgeModule;
}

// Lazy init: VK Bridge SDK инициализируется при первом вызове
let vkInitialized = false;
async function ensureVkInit() {
  if (vkInitialized) return;
  try {
    const vk = await getVkBridge();
    await vk.default.send('VKWebAppInit');
    vkInitialized = true;
  } catch {
    // VK Bridge может быть недоступен в тестовом окружении
  }
}

const vkBridge: PlatformBridge = {
  platform: 'vk',

  getInitData() {
    // VK передаёт launch params через URL search
    const search = window.location.search;
    return search ? search.slice(1) : null;
  },

  getStartParam() {
    // VK deep links через hash
    const hash = window.location.hash;
    return hash ? hash.slice(1) : null;
  },

  expand() {
    ensureVkInit();
  },
  requestFullscreen() { /* VK не поддерживает */ },
  disableVerticalSwipes() { /* VK не поддерживает */ },
  enableClosingConfirmation() { /* VK не поддерживает */ },
  disableClosingConfirmation() { /* VK не поддерживает */ },

  hapticImpact(style: HapticStyle) {
    const vkStyle: 'light' | 'medium' | 'heavy' =
      style === 'light' || style === 'soft' ? 'light' :
      style === 'heavy' || style === 'rigid' ? 'heavy' :
      'medium';
    getVkBridge().then((vk) => {
      vk.default.send('VKWebAppTapticImpactOccurred', { style: vkStyle }).catch(() => {});
    }).catch(() => {});
  },

  hapticNotification(type: HapticNotification) {
    getVkBridge().then((vk) => {
      vk.default.send('VKWebAppTapticNotificationOccurred', { type }).catch(() => {});
    }).catch(() => {});
  },

  hasNativeBackButton: false,
  hasNativeMainButton: false,
};

// ─── Dev ───────────────────────────────────────────────────────────────────

const devBridge: PlatformBridge = {
  platform: 'dev',
  getInitData() { return null; },
  getStartParam() { return null; },
  expand() {},
  requestFullscreen() {},
  disableVerticalSwipes() {},
  enableClosingConfirmation() {},
  disableClosingConfirmation() {},
  hapticImpact() {},
  hapticNotification() {},
  hasNativeBackButton: false,
  hasNativeMainButton: false,
};

// ─── Export ────────────────────────────────────────────────────────────────

function createBridge(): PlatformBridge {
  switch (currentPlatform) {
    case 'telegram': return telegramBridge;
    case 'vk': return vkBridge;
    default: return devBridge;
  }
}

/** Singleton — один bridge на всё приложение */
export const platformBridge: PlatformBridge = createBridge();
