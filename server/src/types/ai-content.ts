export type AiExamplesContent = {
  sentences: Array<{
    en: string;
    ru: string;
    cefr: 'a1' | 'b1' | 'c1';
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
