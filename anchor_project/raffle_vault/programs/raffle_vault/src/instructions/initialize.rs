use crate::{errors::RaffleError, state::*};
use anchor_lang::prelude::*;

pub fn initialize_vault(ctx: Context<InitializeVault>, args: InitializeArgs) -> Result<()> {
    require!(args.ticket_price > 0, RaffleError::InvalidTicketPrice);

    let duration = args.duration_seconds.unwrap_or(DEFAULT_DURATION_SECONDS);
    require!(duration > 0, RaffleError::InvalidDuration);

    let max_tickets = args.max_tickets.clamp(1, MAX_TICKETS as u32);

    let clock = Clock::get()?;
    let vault = &mut ctx.accounts.vault;

    vault.authority = ctx.accounts.authority.key();
    vault.pot = 0;
    vault.ticket_price = args.ticket_price;
    vault.max_tickets = max_tickets;
    vault.ticket_count = 0;
    vault.end_time = clock.unix_timestamp + duration;
    vault.bump = ctx.bumps.vault;
    vault.winner = Pubkey::default();
    vault.tickets = Vec::new();

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", authority.key().as_ref()],
        bump,
        space = Vault::space()
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct InitializeArgs {
    pub ticket_price: u64,
    pub max_tickets: u32,
    pub duration_seconds: Option<i64>,
}
