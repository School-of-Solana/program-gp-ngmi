use anchor_lang::prelude::*;

pub const DEFAULT_DURATION_SECONDS: i64 = 60 * 60;
pub const MAX_TICKETS: usize = 128;

const DISCRIMINATOR: usize = 8;
const PUBKEY: usize = 32;
const U64: usize = 8;
const U32: usize = 4;
const I64: usize = 8;

pub const TICKET_ENTRY_SIZE: usize = PUBKEY + I64;

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
    pub status: VaultStatus,
}

impl Vault {
    pub fn space() -> usize {
        DISCRIMINATOR
            + PUBKEY
            + U64
            + U64
            + U32
            + U32
            + I64
            + 1
            + PUBKEY
            + 4
            + MAX_TICKETS * TICKET_ENTRY_SIZE
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct TicketEntry {
    pub buyer: Pubkey,
    pub purchased_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Open,
    Closed,
    Finished,
}
