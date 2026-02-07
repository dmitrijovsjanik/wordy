import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';

type BackButtonProps = {
  to?: string;
  onClick?: () => void;
  variant?: 'secondary' | 'ghost';
};

export function BackButton({ to, onClick, variant = 'secondary' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button variant={variant} size="icon" onClick={handleClick}>
      <HugeiconsIcon strokeWidth={2} icon={ArrowLeft02Icon} size={20} />
    </Button>
  );
}
