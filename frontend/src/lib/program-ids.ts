import { PublicKey } from '@solana/web3.js';
import { RAFFLE_VAULT_PROGRAM_ADDRESS } from '@/lib/codama/programs';

//export const RAFFLE_VAULT_PROGRAM_ADDRESS = RAFFLE_VAULT_PROGRAM_ADDRESS;
export const RAFFLE_VAULT_PROGRAM_PUBKEY = new PublicKey(
  RAFFLE_VAULT_PROGRAM_ADDRESS
);