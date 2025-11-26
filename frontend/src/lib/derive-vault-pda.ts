import { PublicKey } from '@solana/web3.js';
//import { RAFFLE_VAULT_PROGRAM_ADDRESS } from '@/lib/codama/programs';
import { RAFFLE_VAULT_PROGRAM_PUBKEY } from './program-ids';

const VAULT_SEED = Buffer.from('vault');

export function deriveVaultPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, authority.toBuffer()],
    RAFFLE_VAULT_PROGRAM_PUBKEY
  );
}