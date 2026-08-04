import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Heart, Home, MapPin, Plus, Trash2 } from 'lucide-react';

import { favoritesApi } from '@shared/api';
import type { FavoritePlace } from '@shared/api/types';
import { Button, IconButton } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { ApiError } from '@shared/lib/http';
import { cn } from '@shared/lib/utils';

import { PlaceSearch, type SelectedPlace } from './components/PlaceSearch';

/** Home and Work get their own icon; everything else is a heart. */
function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes('home')) return <Home size={18} />;
  if (l.includes('work') || l.includes('office')) return <Briefcase size={18} />;
  return <Heart size={18} />;
}

const PRESETS = ['Home', 'Work', 'Gym', 'Airport'];

export function FavouritesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<FavoritePlace | null>(null);
  const [label, setLabel] = useState('');
  const [place, setPlace] = useState<SelectedPlace | null>(null);

  const favourites = useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesApi.list(),
    retry: 1,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['favorites'] });

  const create = useMutation({
    mutationFn: () =>
      favoritesApi.create({
        label: label.trim(),
        address: place!.address,
        latitude: place!.position.lat,
        longitude: place!.position.lng,
      }),
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setLabel('');
      setPlace(null);
      toast.success('Saved', 'It will show as a shortcut when you book.');
    },
    onError: (e) => toast.error('Could not save', e instanceof ApiError ? e.userMessage : undefined),
  });

  const remove = useMutation({
    mutationFn: (id: string) => favoritesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setRemoving(null);
      toast.info('Removed');
    },
    onError: (e) => toast.error('Could not remove', e instanceof ApiError ? e.userMessage : undefined),
  });

  const rows = favourites.data ?? [];

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Saved places</h1>
        <IconButton label="Add a place" tone="brand" onClick={() => setAdding(true)}>
          <Plus size={19} />
        </IconButton>
      </header>

      <section className="stagger px-5">
        {favourites.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MapPin size={22} />}
              title="No saved places"
              description="Save the places you go most and they appear as one-tap shortcuts when booking."
              action={
                <Button leadingIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
                  Add your first
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {rows.map((f) => (
              <li key={f.id}>
                <div className="group flex items-center gap-3 rounded-card border border-line bg-card p-4 transition-colors hover:border-line-strong">
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                  >
                    {iconFor(f.label)}
                  </span>

                  <button
                    type="button"
                    onClick={() => navigate('/rider/book')}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-semibold text-ink">{f.label}</p>
                    <p className="truncate text-body-sm text-ink-muted">{f.address}</p>
                  </button>

                  <IconButton
                    label={`Remove ${f.label}`}
                    size="sm"
                    onClick={() => setRemoving(f)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 size={15} className="text-danger-ink" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add */}
      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setLabel('');
          setPlace(null);
        }}
        title="Save a place"
        description="Give it a name you will recognise at a glance."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!label.trim() || !place}
              onClick={() => create.mutate()}
            >
              Save place
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Name</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLabel(p)}
                  className={cn(
                    'rounded-pill border px-3.5 py-1.5 text-caption font-medium transition-colors',
                    label === p
                      ? 'border-brand bg-brand-soft text-brand-ink'
                      : 'border-line text-ink-muted hover:text-ink',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Home"
              aria-label="Place name"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Address</p>
            <PlaceSearch
              label="Address"
              placeholder="Search for an address"
              value={place}
              onSelect={setPlace}
              onClear={() => setPlace(null)}
            />
          </div>
        </div>
      </Modal>

      {/* Remove */}
      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.label}?` : ''}
        description="You can save it again at any time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => removing && remove.mutate(removing.id)}
            >
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}
