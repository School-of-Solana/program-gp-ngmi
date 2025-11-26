'use client';

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useSolana } from '@/components/solana/use-solana';
import { WalletDropdown } from '@/components/wallet-dropdown';
import { AppHero } from '@/components/app-hero';
import { RaffleVaultUiProgramExplorerLink } from './ui/raffle-vault-ui-program-explorer-link';
import { RaffleVaultUiCreate } from './ui/raffle-vault-ui-create';
import { RaffleVaultUiProgram } from './ui/raffle-vault-ui-program';

export default function RaffleVaultFeature() {
  const { account } = useSolana();

  const authorityPublicKey = useMemo(() => {
    if (!account) return null;
    return new PublicKey(account.address);
  }, [account]);

  if (!account || !authorityPublicKey) {
    return (
      <div className="mx-auto max-w-4xl py-16">
        <div className="hero">
          <div className="hero-content text-center">
            <WalletDropdown />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <AppHero
        title="Raffle Vault"
        subtitle='Use the controls below to initialize, enter, and finalize the raffle vault.'
      >
        <p className="mb-6">
          <RaffleVaultUiProgramExplorerLink />
        </p>
        <RaffleVaultUiCreate account={account} />
      </AppHero>

      <RaffleVaultUiProgram authorityPublicKey={authorityPublicKey} />
    </div>
  );
}