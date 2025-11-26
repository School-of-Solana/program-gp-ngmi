# Project Description

**Deployed Frontend URL:** https://raffle-frontend-woad.vercel.app/raffle-vault  
**Solana Program ID:** `BRWhr8mqPoi9gsKrie32hWdLU2jWKBh3PixLXg4sAytA`

---

## Project Overview

### Description
Raffle Vault is an on-chain raffle protocol where any wallet can spin up a raffle “vault,” sell tickets, offer refunds before a deadline, and deterministically select a pending winner after the raffle closes. All lamports flow into a PDA-owned `Vault` account, so the program controls custody end-to-end. A Next.js frontend (Vercel-hosted) lets users connect wallets, configure vaults, buy/refund tickets, finalize raffles as the authority, and claim prizes if they’re the recorded winner.

### Key Features
- **Configurable Initialization:** Creator chooses ticket price, max tickets (clamped 1–128), and optional duration; otherwise defaults to 1 hour.
- **Single Entry Enforcement:** Each wallet can hold exactly one ticket per raffle (`AlreadyEntered` on duplicates).
- **Refund Window:** Buyers can exit and reclaim SOL any time before `end_time`.
- **Two-Step Finalization:** After the deadline the authority records `pending_winner`/`pending_prize`; the winner later claims funds.
- **Authority-Gated Cancellation:** Vault can be closed only when pot + tickets are zero, returning rent to the creator.
- **Full UI Flow:** Vercel app (derived from `create-solana-dapp`) exposes wallet selection, vault CRUD, ticket actions, finalize, cancel, and claim.

---

## How to Use the dApp

1. **Connect Wallet** (Phantom, Solflare, etc.).
2. **Initialize Vault** with ticket price, max tickets, optional duration; creates PDA via `seeds = ["vault", authority]`.
3. **Buy Ticket** once per wallet; SOL transfers into the vault.
4. **Refund Ticket** any time before `end_time`.
5. **Finalize Raffle** (authority only) after the deadline to record pending winner + prize.
6. **Claim Prize** (winner only) to receive lamports and clear payout state.
7. **Cancel Vault** (authority, empty pot/tickets) to close the PDA.

---

## Program Architecture

### PDA Usage
- **Vault PDA:** `seeds = [b"vault", authority_pubkey]`, `bump = vault.bump`.
  - Holds ticket revenue and signs all SOL movements via `invoke_signed`.
  - Enforces that only the true authority can finalize or cancel through PDA-derived seeds.

### Program Instructions
The program uses a single `Vault` account that encapsulates raffle configuration and state. All fund custody and participant lists live inside this PDA-controlled account, ensuring deterministic authority routing and preventing unauthorized withdrawals.

1. **`initialize_raffle`**
   - Validates `ticket_price > 0`, `duration > 0`; clamps `max_tickets`.
   - Writes authority, ticket price, max tickets, `end_time = now + duration`, zeroes counters, stores bump, clears `tickets`.

2. **`enter_raffle` (buy_ticket)**
   - Checks deadline, capacity, and single-entry constraint.
   - CPI to System Program transfers `ticket_price` to the vault.
   - Increments `pot`, `ticket_count`, and pushes `TicketEntry { buyer, purchased_at }`.

3. **`exit_raffle` (refund_ticket)**
   - Requires current time < `end_time`.
   - Finds buyer’s ticket, uses PDA signer seeds to debit vault lamports / credit payer.
   - `swap_remove` ticket, decrement counters, subtract from `pot`.

4. **`payout_raffle` (payout_finalize)**
   - Requires raffle closed, tickets sold, prize not pending/claimed.
   - Sorts tickets (timestamp then buyer), picks index via `timestamp_seed % len`.
   - Stores `pending_winner`, `pending_prize = pot`, sets `status = Finished`, records `winner`.

5. **`claim_raffle`**
   - Winner must match `pending_winner`; `pending_prize > 0`.
   - Transfers prize from vault to winner, zeroes pot/pending fields, clears tickets, sets `paid_out = true`.

6. **`cancel_raffle`**
   - Authority-only; requires `ticket_count == 0` and `pot == 0`.
   - Closes vault PDA, returning rent to authority.



### Account Structure

```rust
#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub pot: u64,
    pub ticket_price: u64,
    pub max_tickets: u32,
    pub ticket_count: u32,
    pub end_time: i64,
    pub bump: u8,
    pub winner: Pubkey,
    pub tickets: Vec<TicketEntry>,
    pub pending_winner: Option<Pubkey>,
    pub pending_prize: u64,
    pub paid_out: bool,
    pub status: VaultStatus, // Open | Closed | Finished
}

pub const DEFAULT_DURATION_SECONDS: i64 = 60 * 60;
pub const MAX_TICKETS: usize = 128;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TicketEntry {
    pub buyer: Pubkey,
    pub purchased_at: i64,
}
```

---

## Error Codes (selected)
`InvalidTicketPrice`, `InvalidDuration`, `VaultClosed`, `VaultStillRunning`, `MaxTicketsReached`, `TicketNotFound`, `AlreadyEntered`, `NoTicketsSold`, `WinnerAlreadyChosen`, `PrizeAlreadyClaimed`, `NoPendingWinner`, `UnauthorizedClaim`, `NothingToPayout`, `UnauthorizedFinalize`, `TicketsOutstanding`, `Unauthorized`.

---

## Testing

### Test Suite
`tests/raffle_vault.ts` (Mocha + Anchor) provisions isolated vaults via helper utilities and covers every instruction with success + failure cases.

#### Happy Path Scenarios
- **Initialize:** Stores creator config, zero counters, respects custom duration.
- **Enter:** First-time buyer increments `ticketCount` and `pot`.
- **Exit:** Refund before deadline removes ticket and restores balances.
- **Payout:** After duration with tickets sold, records pending winner/prize and marks status `Finished`.
- **Claim:** Winner receives SOL, clears pending fields, `paid_out = true`, ticket vector emptied.
- **Cancel:** Empty vault closes and rent returns to authority.

#### Unhappy Path Scenarios
- **Initialize:** Zero price or non-positive duration.
- **Enter:** Duplicate entry, post-deadline purchase, exceeding `maxTickets`.
- **Exit:** Non-buyer refund or refund after closure.
- **Payout:** Called early, with zero tickets, repeated after winner pending, or by non-authority (fails PDA seeds).
- **Claim:** Missing pending winner, wrong wallet, double-claim after payout.
- **Cancel:** Outstanding tickets/pot or stranger calling cancel.

Each negative test asserts the exact `RaffleError` string (e.g., “Vault has already closed”, “Duplicate entry detected”) to lock validation semantics.

### Running Tests
```bash
cd anchor_project/raffle_vault
anchor test
```

---

