use anchor_lang::prelude::*;

use crate::errors::RaffleError;
use crate::state::Vault;

pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
    // Clone the account infos up front so we can manipulate lamports
    // independently of the later &mut vault borrow.
    let vault_info = ctx.accounts.vault.to_account_info();
    let winner_info = ctx.accounts.winner.to_account_info();

    let pending_winner = ctx
        .accounts
        .vault
        .pending_winner
        .ok_or(RaffleError::NoPendingWinner)?;
    let winner_key = ctx.accounts.winner.key();
    require_keys_eq!(pending_winner, winner_key, RaffleError::UnauthorizedClaim);

    let pending_prize = ctx.accounts.vault.pending_prize;
    require!(pending_prize > 0, RaffleError::NothingToPayout);

    {
        let mut vault_lamports = vault_info.try_borrow_mut_lamports()?;
        let mut winner_lamports = winner_info.try_borrow_mut_lamports()?;

        require!(
            **vault_lamports >= pending_prize,
            RaffleError::NothingToPayout
        );

        **vault_lamports -= pending_prize;
        **winner_lamports += pending_prize;
    }

    // Now it’s safe to mutably borrow the vault account itself.
    let vault = &mut ctx.accounts.vault;
    vault.pot = 0;
    vault.pending_prize = 0;
    vault.pending_winner = None;
    vault.paid_out = true;
    vault.ticket_count = 0;
    vault.tickets.clear();

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub winner: Signer<'info>,
}
