// Here we export some useful types and functions for interacting with the Anchor program.
import TempraffleVaultIDL from '../anchor_project/raffle_vault/target/idl/raffle_vault.json'

// Re-export the generated IDL and type
export { TempraffleVaultIDL }

export * from './client/js'
