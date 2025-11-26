#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use crate::instructions::*; //{
                            //buy_ticket::BuyTicket,
                            //cancel_vault::CancelVault,
                            //initialize::{InitializeArgs, InitializeVault},
                            //payout_winner::PayoutWinner,
                            //refund_ticket::RefundTicket,
                            //};

declare_id!("BRWhr8mqPoi9gsKrie32hWdLU2jWKBh3PixLXg4sAytA");

#[program]
pub mod raffle_vault {
    use super::*;

    pub fn initialize_raffle(ctx: Context<InitializeVault>, args: InitializeArgs) -> Result<()> {
        initialize_vault(ctx, args)
    }

    pub fn enter_raffle(ctx: Context<BuyTicket>) -> Result<()> {
        buy_ticket(ctx)
    }

    pub fn exit_raffle(ctx: Context<RefundTicket>) -> Result<()> {
        refund_ticket(ctx)
    }

    pub fn payout_raffle(ctx: Context<PayoutFinalize>) -> Result<()> {
        payout_finalize(ctx)
    }

    pub fn claim_raffle(ctx: Context<ClaimPrize>) -> Result<()> {
        claim_prize(ctx)
    }

    pub fn cancel_raffle(ctx: Context<CancelVault>) -> Result<()> {
        cancel_vault(ctx)
    }
}
