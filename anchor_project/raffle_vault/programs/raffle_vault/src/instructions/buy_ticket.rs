use anchor_lang::{
    prelude::*,
    system_program::{self, Transfer},
};

use crate::{errors::RaffleError, state::*};

pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
    let clock = Clock::get()?;
    let payer_key = ctx.accounts.payer.key();

    {
        let vault = &ctx.accounts.vault;
        require!(
            clock.unix_timestamp < vault.end_time,
            RaffleError::VaultClosed
        );
        require!(
            (vault.ticket_count as usize) < vault.max_tickets as usize,
            RaffleError::MaxTicketsReached
        );
        require!(
            vault.tickets.len() < MAX_TICKETS,
            RaffleError::MaxTicketsReached
        );
        require!(
            vault.tickets.iter().all(|entry| entry.buyer != payer_key),
            RaffleError::AlreadyEntered
        );
    }

    let ticket_price = ctx.accounts.vault.ticket_price;

    let payer_ai = ctx.accounts.payer.to_account_info();
    let vault_ai = ctx.accounts.vault.to_account_info();
    let transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: payer_ai,
            to: vault_ai,
        },
    );
    system_program::transfer(transfer_ctx, ticket_price)?;

    let vault = &mut ctx.accounts.vault;
    vault.pot = vault
        .pot
        .checked_add(ticket_price)
        .ok_or(RaffleError::MathOverflow)?;
    vault.ticket_count = vault
        .ticket_count
        .checked_add(1)
        .ok_or(RaffleError::MathOverflow)?;
    vault.tickets.push(TicketEntry {
        buyer: payer_key,
        purchased_at: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,
    pub system_program: Program<'info, System>,
}
