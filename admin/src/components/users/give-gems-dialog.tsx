import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { giveGems } from '@/lib/api';

interface Props {
  userId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newGems: number) => void;
}

export function GiveGemsDialog({ userId, open, onOpenChange, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await giveGems(userId, numAmount, reason);
      onSuccess(result.newGems);
      onOpenChange(false);
      setAmount('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Выдать гемы</DialogTitle>
          <DialogDescription>Укажите количество гемов для начисления пользователю #{userId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Количество</label>
            <Input
              type="number"
              min="1"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Причина (необязательно)</label>
            <Input
              placeholder="Компенсация, тест..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Отправка...' : 'Выдать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
