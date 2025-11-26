import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { ellipsify } from '@wallet-ui/react';
import { AppAlert } from '@/components/app-alert';
import { useVaultAccountQuery } from '../data-access/use-vault-account-query';
import { VaultStatus } from '@/lib/codama/types';

type Props = {
  authorityPublicKey: PublicKey;
};

const statusLabel: Record<VaultStatus, string> = {
  [VaultStatus.Open]: 'Open',
  [VaultStatus.Closed]: 'Closed',
  [VaultStatus.Finished]: 'Finished',
};

const lamportsToSol = (lamports: bigint | number) =>
  Number(lamports) / LAMPORTS_PER_SOL;

const unwrapOption = <T,>(option: unknown): T | null => {
  if (!option) return null;
  if (Array.isArray(option)) {
    const [isSome, value] = option as [boolean, T];
    return isSome ? value : null;
    }
  if (typeof option === 'object' && 'value' in (option as Record<string, T>)) {
    return (option as Record<string, T>).value;
  }
  return null;
};

export function RaffleVaultUiProgram({ authorityPublicKey }: Props) {
  const query = useVaultAccountQuery(authorityPublicKey);

  if (query.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }

  const maybeAccount = query.data?.account ?? null;
  /*
  if (!maybeAccount) {
    return (
      <AppAlert>
        Vault account not found. Run initialization to create it on-chain.
      </AppAlert>
    );
  }
    */

   if (!maybeAccount || !maybeAccount.exists) {
    return (
      <AppAlert>
        Vault account not found. Run initialization to create it on-chain.
      </AppAlert>
    );
  }

  //const vault = maybeAccount.data;

  const vault = maybeAccount.data;
  if (!vault) {
    return (
      <AppAlert>
        Vault account exists but contains no readable data. Ensure it was
        initialized with the current program deployment.
      </AppAlert>
    );
  }

  const pendingWinner = vault.pendingWinner
    ? unwrapOption<string>(vault.pendingWinner)
    : null;
  const status = statusLabel[vault.status] ?? `Unknown (${vault.status})`;

  return (
    <div className="space-y-4 rounded-lg border bg-base-100 p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoRow label="Vault PDA" value={ellipsify(maybeAccount.address)} />
        <InfoRow label="Authority" value={ellipsify(vault.authority)} />
        <InfoRow
          label="Ticket Price (SOL)"
          value={lamportsToSol(vault.ticketPrice).toFixed(4)}
        />
        <InfoRow
          label="Pot (SOL)"
          value={lamportsToSol(vault.pot).toFixed(4)}
        />
        <InfoRow
          label="Tickets Sold"
          value={`${vault.ticketCount} / ${vault.maxTickets}`}
        />
        <InfoRow label="Status" value={status} />
        <InfoRow
          label="Winner"
          value={vault.winner ? ellipsify(vault.winner) : '—'}
        />
        <InfoRow
          label="Pending Winner"
          value={pendingWinner ? ellipsify(pendingWinner) : '—'}
        />
      </div>
      <details className="rounded bg-base-200 p-3">
        <summary className="cursor-pointer font-medium">Raw account data</summary>
        <pre className="mt-3 overflow-x-auto text-sm">
          {JSON.stringify(
            vault,
            (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
            2
          )}
        </pre>
      </details>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm font-semibold text-base-content/70">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}