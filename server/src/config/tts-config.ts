export const VALID_VOICES = [
  'en-US-EmmaMultilingualNeural',
  'en-US-AriaNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'en-US-ChristopherNeural',
  'en-GB-SoniaNeural',
  'en-GB-RyanNeural',
] as const;

export const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

export const PREMIUM_VOICES = VALID_VOICES.filter((v) => v !== DEFAULT_VOICE);

export type TtsVoiceId = (typeof VALID_VOICES)[number];
