'use client';

import { useMemo, useState } from 'react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { UiWalletAccount } from '@wallet-ui/react';
import { Button } from '@/components/ui/button';
import { deriveVaultPda } from '@/lib/derive-vault-pda';
import {
  useCancelRaffleMutation,
  useClaimRaffleMutation,
  useEnterRaffleMutation,
  useExitRaffleMutation,
  useInitializeRaffleMutation,
  usePayoutRaffleMutation,
} from '../data-access/use-raffle-vault-mutations';

type Props = {
  account: UiWalletAccount;
};

const solToLamports = (value: string): bigint => {
  const sol = Number(value);
  if (Number.isNaN(sol) || sol <= 0) return BigInt(0);
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
};

const minutesToSeconds = (value: string): bigint | null => {
  if (!value.trim()) return null;
  const minutes = Number(value);
  if (Number.isNaN(minutes) || minutes <= 0) return null;
  return BigInt(Math.round(minutes * 60));
};

export function RaffleVaultUiCreate({ account }: Props) {
  const authorityPublicKey = useMemo(
    () => new PublicKey(account.address),
    [account.address]
  );
  const [derivedVaultPda] = useMemo(
    () => deriveVaultPda(authorityPublicKey),
    [authorityPublicKey]
  );

  const [manualVaultAddress, setManualVaultAddress] = useState('');
  const vaultPublicKey = useMemo(() => {
    if (!manualVaultAddress.trim()) return derivedVaultPda;
    try {
      return new PublicKey(manualVaultAddress.trim());
    } catch {
      return derivedVaultPda;
    }
  }, [manualVaultAddress, derivedVaultPda]);

  const initializeMutation = useInitializeRaffleMutation({ account });
  const enterMutation = useEnterRaffleMutation({
    account,
    vaultAddress: vaultPublicKey,
  });
  const exitMutation = useExitRaffleMutation({
    account,
    vaultAddress: vaultPublicKey,
  });
  const claimMutation = useClaimRaffleMutation({
    account,
    vaultAddress: vaultPublicKey,
  });
  const cancelMutation = useCancelRaffleMutation({ account });
  const payoutMutation = usePayoutRaffleMutation({ account });

  const [ticketPrice, setTicketPrice] = useState('0.10');
  const [maxTickets, setMaxTickets] = useState('100');
  const [durationMinutes, setDurationMinutes] = useState('60');

  const handleInitialize = () =>
    initializeMutation.mutate({
      ticketPriceLamports: solToLamports(ticketPrice),
      maxTickets: Number(maxTickets) || 0,
      durationSeconds: minutesToSeconds(durationMinutes),
    });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-base-100 p-4 shadow-sm">
        <header className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Initialize Vault (authority = your wallet)
          </p>
          <p className="font-mono text-xs text-base-content/70">
            {derivedVaultPda.toBase58()}
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Ticket Price (SOL)</span>
            <input
              className="input input-bordered"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Max Tickets</span>
            <input
              className="input input-bordered"
              value={maxTickets}
              onChange={(e) => setMaxTickets(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Duration (minutes)</span>
            <input
              className="input input-bordered"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            onClick={handleInitialize}
            disabled={initializeMutation.isPending}
          >
            {initializeMutation.isPending ? 'Initializing…' : 'Initialize'}
          </Button>
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Canceling…' : 'Cancel Vault'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-base-100 p-4 shadow-sm space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
          Player Actions (enter / exit / claim)
        </p>
        <label className="form-control">
          <span className="label-text">Vault Address (optional override)</span>
          <input
            className="input input-bordered font-mono text-xs"
            placeholder={derivedVaultPda.toBase58()}
            value={manualVaultAddress}
            onChange={(e) => setManualVaultAddress(e.target.value)}
          />
          <span className="label-text-alt">
            Leave blank to target your derived vault.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => enterMutation.mutate()}
            disabled={enterMutation.isPending}
          >
            {enterMutation.isPending ? 'Entering…' : 'Enter Raffle'}
          </Button>
          <Button
            variant="outline"
            onClick={() => exitMutation.mutate()}
            disabled={exitMutation.isPending}
          >
            {exitMutation.isPending ? 'Exiting…' : 'Exit Raffle'}
          </Button>
          <Button
            variant="outline"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? 'Claiming…' : 'Claim Prize'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-base-100 p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-content/60">
          Authority Actions
        </p>
        <Button
          variant="secondary"
          onClick={() => payoutMutation.mutate()}
          disabled={payoutMutation.isPending}
        >
          {payoutMutation.isPending ? 'Paying out…' : 'Finalize / Payout'}
        </Button>
      </section>
    </div>
  );
}