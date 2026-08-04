import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Download, UserCheck, UserPlus, Users } from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import type { User, UserRole } from '@shared/api/types';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { Modal } from '@shared/components/ui/Modal';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { StatCard } from '@shared/components/ui/StatCard';
import { useToast } from '@shared/components/ui/Toast';
import { ApiError } from '@shared/lib/http';
import { cn, formatDateTime, fullName, initials } from '@shared/lib/utils';

const ROLE_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'rider', label: 'Riders' },
  { id: 'driver', label: 'Drivers' },
  { id: 'admin', label: 'Admins' },
];

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [role, setRole] = useState('all');
  const [suspending, setSuspending] = useState<User | null>(null);

  const users = useQuery({
    queryKey: ['admin', 'users', role],
    queryFn: () => adminApi.users(role === 'all' ? { per_page: 100 } : { role, per_page: 100 }),
    retry: 1,
  });

  const suspend = useMutation({
    mutationFn: (id: string) => adminApi.suspendUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSuspending(null);
      toast.success('Account suspended');
    },
    onError: (e) =>
      toast.error('Could not suspend', e instanceof ApiError ? e.userMessage : undefined),
  });

  const activate = useMutation({
    mutationFn: (id: string) => adminApi.activateUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Account reactivated');
    },
    onError: (e) =>
      toast.error('Could not reactivate', e instanceof ApiError ? e.userMessage : undefined),
  });

  const rows = users.data?.items ?? [];

  const counts = {
    total: rows.length,
    riders: rows.filter((u) => u.role === 'rider').length,
    drivers: rows.filter((u) => u.role === 'driver').length,
    verified: rows.filter((u) => u.is_verified).length,
  };

  const columns: Column<User>[] = [
    {
      key: 'person',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar initials={initials(u)} src={u.profile_image} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{fullName(u) || '—'}</p>
            <p className="truncate text-caption text-ink-muted">{u.email}</p>
          </div>
        </div>
      ),
      value: (u) => `${fullName(u)} ${u.email}`,
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <RoleBadge role={u.role} />,
      value: (u) => u.role,
    },
    {
      key: 'phone',
      header: 'Phone',
      secondary: true,
      render: (u) => <span className="tabular text-ink-muted">{u.phone_number || '—'}</span>,
      value: (u) => u.phone_number,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={u.is_active ? 'success' : 'danger'} dot>
            {u.is_active ? 'Active' : 'Suspended'}
          </Badge>
          {u.is_verified && <Badge tone="muted">Verified</Badge>}
        </div>
      ),
      value: (u) => (u.is_active ? 'active' : 'suspended'),
    },
    {
      key: 'joined',
      header: 'Joined',
      secondary: true,
      align: 'right',
      render: (u) => <span className="text-ink-muted">{formatDateTime(u.created_at)}</span>,
      value: (u) => u.created_at,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) =>
        u.is_active ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Ban size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setSuspending(u);
            }}
            className="text-danger hover:bg-danger-soft"
          >
            Suspend
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<CheckCircle2 size={14} />}
            loading={activate.isPending}
            onClick={(e) => {
              e.stopPropagation();
              activate.mutate(u.id);
            }}
            className="text-success hover:bg-success-soft"
          >
            Restore
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone registered on the platform — riders, drivers and administrators."
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Download size={16} />}>
              Export
            </Button>
            <Button leadingIcon={<UserPlus size={16} />}>Invite</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={String(counts.total)} icon={<Users size={17} />} loading={users.isLoading} />
        <StatCard label="Riders" value={String(counts.riders)} icon={<Users size={17} />} loading={users.isLoading} />
        <StatCard label="Drivers" value={String(counts.drivers)} icon={<UserCheck size={17} />} loading={users.isLoading} />
        <StatCard label="Verified" value={String(counts.verified)} icon={<CheckCircle2 size={17} />} loading={users.isLoading} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        loading={users.isLoading}
        error={users.isError}
        onRetry={() => void users.refetch()}
        searchable
        searchPlaceholder="Search by name, email or phone…"
        pageSize={12}
        emptyTitle="No users yet"
        emptyDescription="Accounts appear here as people register."
        toolbar={
          <div className="flex gap-1 rounded-pill border border-line p-1">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRole(f.id)}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-caption font-medium transition-colors',
                  role === f.id ? 'brand-gradient text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <Modal
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        title="Suspend this account?"
        description={
          suspending
            ? `${fullName(suspending) || suspending.email} will be signed out and unable to use AC7 Ride until reactivated. Trips in progress are not cancelled automatically.`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={suspend.isPending}
              onClick={() => suspending && suspend.mutate(suspending.id)}
            >
              Suspend account
            </Button>
          </>
        }
      />
    </>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const map = {
    admin: { tone: 'brand' as const, label: 'Admin' },
    driver: { tone: 'neutral' as const, label: 'Driver' },
    rider: { tone: 'muted' as const, label: 'Rider' },
  };
  const entry = map[role] ?? map.rider;
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
