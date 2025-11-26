use anchor_lang::prelude::*;

use crate::{errors::RaffleError, state::*};

pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    require_keys_eq!(
        ctx.accounts.authority.key(),
        vault.authority,
        RaffleError::Unauthorized
    );
    require_eq!(vault.ticket_count, 0, RaffleError::TicketsOutstanding);
    require_eq!(vault.pot, 0, RaffleError::TicketsOutstanding);
    Ok(())
}

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        close = authority
    )]
    pub vault: Box<Account<'info, Vault>>,
    pub system_program: Program<'info, System>,
}
