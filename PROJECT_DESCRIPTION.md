# Project Description

**Deployed Frontend URL:** https://raffle-frontend-woad.vercel.app/raffle-vault
**Solana Program ID:** BRWhr8mqPoi9gsKrie32hWdLU2jWKBh3PixLXg4sAytA

---

## Project Overview

### Description
Raffle Vault is a fully on-chain raffle protocol where any wallet can permissionlessly spin up a single-raffle “vault,” sell tickets, refund entrants before the deadline, and deterministically finalize a winner once the raffle closes. The entire lifecycle—from ticket sales and refunds to randomness generation and prize payout—is enforced by a PDA-owned vault account so that funds never leave program custody until the rightful winner is determined. A lightweight React/Next.js frontend on Vercel lets users initialize vaults, buy/refund tickets, and (if they are the creator) finalize or cancel the raffle.

### Key Features
- **Vault Initialization:** Any wallet can create a raffle vault with a chosen ticket price; duration is fixed (30 minutes).
- **Single-Entry Tickets:** Each wallet may hold at most one ticket per raffle; attempts to double-enter revert.
- **Refund Window:** Entrants can exit (and receive their SOL back) any time before the raffle end timestamp.
- **Deterministic Finalization:** After the deadline, only the vault authority can finalize; winner is computed via a hash over vault config + clock time, modulo participant count.
- **Direct Prize Settlement:** Payout is sent immediately to the recorded winner, whether it is an EOA or program-derived account.
- **Creator Cancellation:** Before the deadline, the vault owner can cancel and automatically refund every participant in a single instruction.

---

## How to Use the dApp

1. **Connect Wallet** via the Vercel-hosted UI (Phantom, Solflare, etc.).
2. **Initialize Vault**
   - Input a ticket price (SOL).
   - Click “Initialize” to create the PDA-based vault tied to your wallet.
3. **Buy Ticket**
   - Anyone can click “Buy Ticket” to enter; SOL moves into the vault PDA.
4. **Refund Ticket (Optional)**
   - Before the fixed end time (30 minutes after creation), a participant may click “Refund Ticket” to exit.
5. **Finalize Raffle**
   - After end time, the vault creator clicks “Finalize”. The program hashes vault seeds + timestamps, selects the winner index, transfers the pot, and marks the raffle finished.
6. **Cancel (Creator Only, Before End)**
   - If needed, the creator can cancel; each participant is refunded automatically.

---

## Program Architecture

The program uses a single `Vault` account that encapsulates raffle configuration and state. All fund custody and participant lists live inside this PDA-controlled account, ensuring deterministic authority routing and preventing unauthorized withdrawals.

### PDA Usage
- **Vault PDA:** `seeds = ["vault", authority_pubkey]`
  - Owns ticket revenue (lamports) and enforces creator-only admin actions.
  - Used as the signer for SOL refunds/payouts via `invoke_signed`.

### Program Instructions
1. **`initialize_raffle`**
   - Creates the PDA vault, stores ticket price, start/end times, and bumps.
2. **`enter_raffle`**
   - Checks deadline + uniqueness, transfers ticket price to PDA, appends buyer to participants list.
3. **`exit_raffle`**
   - Before end time, removes participant entry, decrements counters, and refunds SOL.
4. **`finalize_raffle`**
   - Authority-only; requires raffle to be closed. Hashes vault parameters + current clock to derive winner index, transfers pot directly to the winner, and marks status as `Finalized`.
5. **`cancel_raffle`**
   - Authority-only before deadline. Iterates through participants via remaining accounts, refunds each, clears state, and marks status `Cancelled`.

### Account Structure
```rust
#[account]
pub struct Vault {
    pub authority: Pubkey,        // Vault owner
    pub ticket_price: u64,        // SOL per entry
    pub start_time: i64,          // Creation timestamp
    pub end_time: i64,            // Fixed deadline (start + 30m)
    pub pot: u64,                 // Total lamports held
    pub ticket_count: u32,        // Number of tickets sold
    pub winner: Pubkey,           // Winner public key (set on finalize)
    pub status: VaultStatus,      // Open | Finalized | Cancelled
    pub bump: u8,                 // PDA bump
    pub participants: Vec<Pubkey> // Single-entry list of buyers
}
```

---

## Testing

### Test Coverage
A comprehensive TypeScript test suite (Mocha + Anchor) ensures every instruction has happy-path and failure-path coverage:

**Happy Path Tests**
- Initialize vault with valid ticket price.
- Buy a ticket, pot updates, participant recorded.
- Refund ticket before deadline, pot/ticket count revert.
- Finalize after deadline selects winner and zeroes pot.
- Creator cancellation refunds all participants.

**Unhappy Path Tests**
- Initialize with zero ticket price → `InvalidTicketPrice`.
- Double entry by same wallet → `AlreadyEntered`.
- Purchase after deadline → `Raffle ended`.
- Refund after deadline or by non-participant → respective errors.
- Finalize before deadline or by non-authority → `RaffleRunning` / `Unauthorized`.
- Cancel without supplying remaining accounts for refunds → `RemainingAccountsMismatch`.

### Running Tests
```bash
cd anchor_project/raffle_vault && anchor test
```

---

