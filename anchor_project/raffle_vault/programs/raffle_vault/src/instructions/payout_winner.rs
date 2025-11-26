use anchor_lang::prelude::*;

use crate::errors::RaffleError;
use crate::state::{TicketEntry, Vault, VaultStatus};

pub fn payout_finalize(ctx: Context<PayoutFinalize>) -> Result<()> {
    let clock = Clock::get()?;
    let vault = &mut ctx.accounts.vault;

    require!(
        clock.unix_timestamp >= vault.end_time,
        RaffleError::VaultStillRunning
    );
    require!(vault.ticket_count > 0, RaffleError::NoTicketsSold);
    require!(!vault.paid_out, RaffleError::PrizeAlreadyClaimed);
    require!(
        vault.pending_winner.is_none(),
        RaffleError::WinnerAlreadyChosen
    );

    let timestamp_seed = clock.unix_timestamp as u64;

    let mut ordered: Vec<TicketEntry> = vault.tickets.clone();
    ordered.sort_unstable_by(|a, b| {
        a.purchased_at
            .cmp(&b.purchased_at)
            .then_with(|| a.buyer.cmp(&b.buyer))
    });

    let idx = (timestamp_seed as usize) % ordered.len();
    let winner_key = ordered[idx].buyer;

    vault.pending_winner = Some(winner_key);
    vault.pending_prize = vault.pot;
    vault.status = VaultStatus::Finished;
    vault.winner = winner_key;

    Ok(())
}

#[derive(Accounts)]
pub struct PayoutFinalize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ RaffleError::UnauthorizedFinalize,
    )]
    pub vault: Account<'info, Vault>,
}
