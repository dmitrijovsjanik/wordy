export const TTS_VOICES = [
  { id: 'en-US-EmmaMultilingualNeural', name: 'Emma', gender: 'F' as const, accent: 'US', premium: false, preview: "Hello, my name is Emma. Let us learn some new words together!" },
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'F' as const, accent: 'US', premium: true, preview: "Hey there, I'm Aria. Ready to expand your vocabulary?" },
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'F' as const, accent: 'US', premium: true, preview: "Hello! My name is Jenny. I'll help you practice pronunciation." },
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'M' as const, accent: 'US', premium: true, preview: "What's up? I'm Guy. Let's get your English sounding great!" },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'M' as const, accent: 'US', premium: true, preview: "Good day, I'm Christopher. Shall we start the lesson?" },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'F' as const, accent: 'GB', premium: true, preview: "Hello, I'm Sonia. Fancy a bit of British English today?" },
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'M' as const, accent: 'GB', premium: true, preview: "Hi, I'm Ryan. Let me guide you through proper English." },
] as const;

export const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

export type TtsVoiceId = (typeof TTS_VOICES)[number]['id'];
