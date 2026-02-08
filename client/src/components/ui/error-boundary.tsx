import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
};

type State = {
  error: Error | null;
};

// ErrorBoundary requires a class component — React has no hook equivalent
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }

      return (
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-6">
          <p className="text-center text-sm text-[var(--gray-11)]">
            Не удалось загрузить страницу
          </p>
          <Button variant="secondary" onClick={this.reset}>
            Попробовать снова
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
