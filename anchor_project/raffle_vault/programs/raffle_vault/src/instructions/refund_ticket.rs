use anchor_lang::{
    prelude::*,
    system_program::{self, Transfer},
};

use crate::{errors::RaffleError, state::*};

pub fn refund_ticket(ctx: Context<RefundTicket>) -> Result<()> {
    let clock = Clock::get()?;
    let payer_key = ctx.accounts.payer.key();

    {
        let vault = &ctx.accounts.vault;
        require!(
            clock.unix_timestamp < vault.end_time,
            RaffleError::VaultClosed
        );
    }

    let (entry_idx, refund_amount, authority_key, bump) = {
        let vault = &ctx.accounts.vault;
        let idx = vault
            .tickets
            .iter()
            .position(|entry| entry.buyer == payer_key)
            .ok_or(RaffleError::TicketNotFound)?;
        (idx, vault.ticket_price, vault.authority, vault.bump)
    };

    let bump_seed = [bump];
    let signer_seeds: [&[u8]; 3] = [b"vault", authority_key.as_ref(), &bump_seed];
    let signer = &[&signer_seeds[..]];

    let vault_ai = ctx.accounts.vault.to_account_info();
    let payer_ai = ctx.accounts.payer.to_account_info();

    **vault_ai.try_borrow_mut_lamports()? = vault_ai
        .lamports()
        .checked_sub(refund_amount)
        .ok_or(RaffleError::MathOverflow)?;
    **payer_ai.try_borrow_mut_lamports()? = payer_ai
        .lamports()
        .checked_add(refund_amount)
        .ok_or(RaffleError::MathOverflow)?;

    let vault = &mut ctx.accounts.vault;
    vault.tickets.swap_remove(entry_idx);
    vault.ticket_count = vault
        .ticket_count
        .checked_sub(1)
        .ok_or(RaffleError::MathOverflow)?;
    vault.pot = vault
        .pot
        .checked_sub(refund_amount)
        .ok_or(RaffleError::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct RefundTicket<'info> {
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
