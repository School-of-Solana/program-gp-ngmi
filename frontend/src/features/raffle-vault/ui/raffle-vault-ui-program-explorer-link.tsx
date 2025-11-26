import { RAFFLE_VAULT_PROGRAM_ADDRESS } from '@/lib/codama/programs';
import { AppExplorerLink } from '@/components/app-explorer-link';
import { ellipsify } from '@wallet-ui/react';

export function RaffleVaultUiProgramExplorerLink() {
  return (
    <AppExplorerLink
      address={RAFFLE_VAULT_PROGRAM_ADDRESS}
      label={ellipsify(RAFFLE_VAULT_PROGRAM_ADDRESS)}
    />
  );
}