import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WordItem } from '@/components/ui/word-item';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';

type Tab = 'library' | 'words' | 'marketplace';

export function Collections() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const {
    library,
    marketplace,
    allWords,
    isLoading,
    fetchLibrary,
    fetchMarketplace,
    fetchAllWords,
    toggle,
  } = useCollectionStore();

  useEffect(() => {
    fetchLibrary();
    fetchMarketplace();
    fetchAllWords();
  }, [fetchLibrary, fetchMarketplace, fetchAllWords]);

  return (
    <div className="flex min-h-full flex-col px-4">
      {/* Sticky tabs */}
      <div className="pointer-events-none sticky top-0 z-10 -mx-4">
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pt-4">
          <TabsList>
            <TabsTrigger active={activeTab === 'library'} onClick={() => setActiveTab('library')}>
              Библиотека
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'words'} onClick={() => setActiveTab('words')}>
              Все слова
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'marketplace'} onClick={() => setActiveTab('marketplace')}>
              Каталог
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="h-8 bg-gradient-to-b from-[var(--gray-1)] to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 pb-4">
        {isLoading && (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        )}

        {activeTab === 'library' && !isLoading && (
          <>
            {library.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Библиотека пуста. Добавьте коллекцию из каталога!
              </p>
            )}

            {library.map((col) => (
              <Card
                key={col.id}
                className="cursor-pointer p-4"
                onClick={() => navigate(`/collections/${col.id}`)}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold leading-6">{col.title}</h3>
                    {col.description && (
                      <p className="text-sm text-[var(--gray-11)]">{col.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      asChild
                      variant={col.isActive ? 'success' : 'default'}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(col.id, !col.isActive);
                        }}
                      >
                        {col.isActive ? 'Вкл.' : 'Выкл.'}
                      </button>
                    </Badge>
                    <Badge variant="secondary">
                      {col.totalWords} слов
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {activeTab === 'words' && !isLoading && (
          <>
            {allWords.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Нет слов. Добавьте коллекции в библиотеку!
              </p>
            )}

            {allWords.map((w, i) => (
              <WordItem key={`${w.word}-${w.translation}-${i}`} word={w.word} translation={w.translation} />
            ))}
          </>
        )}

        {activeTab === 'marketplace' && !isLoading && (
          <>
            {marketplace.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Каталог пуст
              </p>
            )}

            {marketplace.map((col) => (
              <Card
                key={col.id}
                className="cursor-pointer p-4"
                onClick={() => navigate(`/collections/${col.id}`)}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold leading-6">{col.title}</h3>
                    {col.description && (
                      <p className="text-sm text-[var(--gray-11)]">{col.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!col.price && (
                      <Badge variant="primary">Бесплатно</Badge>
                    )}
                    <Badge variant="secondary">
                      {col.totalWords} слов
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Create button */}
      {activeTab === 'library' && !isLoading && (
        <div className="pointer-events-none sticky bottom-0 -mx-4">
          <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
          <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
            <Button
              className="w-full gap-2"
              onClick={() => navigate('/collections/create')}
            >
              <HugeiconsIcon icon={Add01Icon} size={18} />
              Создать коллекцию
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
