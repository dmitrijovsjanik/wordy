import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGrammarStore } from '@/stores/grammar-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/components/ui/back-button';
import { ArticleQuiz } from '@/components/grammar/article-quiz';
import { TenseQuiz } from '@/components/grammar/tense-quiz';
import { TenseReference } from '@/components/grammar/tense-reference';
import { CollocationQuiz } from '@/components/grammar/collocation-quiz';
import { FalseFriendsQuiz } from '@/components/grammar/false-friends-quiz';

export function GrammarPage() {
  const navigate = useNavigate();
  const activeTab = useGrammarStore((s) => s.activeTab);
  const setActiveTab = useGrammarStore((s) => s.setActiveTab);
  const tenseView = useGrammarStore((s) => s.tenseView);

  useBackButton(useCallback(() => navigate('/modes'), [navigate]));

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton to="/modes" variant="ghost" />
        <h1 className="text-xl font-bold">Грамматика</h1>
      </div>

      {/* Tabs */}
      <Tabs className="mt-4">
        <TabsList>
          <TabsTrigger
            active={activeTab === 'articles'}
            onClick={() => setActiveTab('articles')}
          >
            Артикли
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === 'tenses'}
            onClick={() => setActiveTab('tenses')}
          >
            Времена
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === 'collocations'}
            onClick={() => setActiveTab('collocations')}
          >
            Фразы
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === 'false-friends'}
            onClick={() => setActiveTab('false-friends')}
          >
            Ловушки
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {activeTab === 'articles' && <ArticleQuiz />}
        {activeTab === 'tenses' && (tenseView === 'reference' ? <TenseReference /> : <TenseQuiz />)}
        {activeTab === 'collocations' && <CollocationQuiz />}
        {activeTab === 'false-friends' && <FalseFriendsQuiz />}
      </div>
    </div>
  );
}
