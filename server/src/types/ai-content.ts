export type AiExamplesContent = {
  sentences: Array<{
    en: string;
    ru: string;
  }>;
};

export type AiMnemonicContent = {
  association: string;
};

export type AiHintsContent = {
  hints: Array<{
    level: number;
    text: string;
  }>;
};

export type AiContentType = 'examples' | 'mnemonic' | 'hints';
