import { create } from 'zustand';

type GrammarTab = 'articles' | 'tenses' | 'collocations' | 'false-friends';
type TenseView = 'quiz' | 'reference';

type GrammarState = {
  activeTab: GrammarTab;
  setActiveTab: (tab: GrammarTab) => void;
  tenseView: TenseView;
  setTenseView: (view: TenseView) => void;
};

export const useGrammarStore = create<GrammarState>()((set) => ({
  activeTab: 'articles',
  setActiveTab: (tab) => set({ activeTab: tab }),
  tenseView: 'quiz',
  setTenseView: (view) => set({ tenseView: view }),
}));
