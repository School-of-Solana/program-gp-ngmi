use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    #[msg("Ticket price must be greater than zero")]
    InvalidTicketPrice,
    #[msg("Vault duration must be positive")]
    InvalidDuration,
    #[msg("Vault has already closed")]
    VaultClosed,
    #[msg("Vault is still running")]
    VaultStillRunning,
    #[msg("Maximum number of tickets reached")]
    MaxTicketsReached,
    #[msg("Ticket not found for this payer")]
    TicketNotFound,
    #[msg("No tickets were sold")]
    NoTicketsSold,
    #[msg("Recipient does not match winner")]
    RecipientMismatch,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Tickets still outstanding")]
    TicketsOutstanding,
    #[msg("Duplicate entry detected")]
    AlreadyEntered,
    #[msg("Missing bump seed in context")]
    MissingBump,
    #[msg("Prize already claimed")]
    PrizeAlreadyClaimed,
    #[msg("Winner already chosen")]
    WinnerAlreadyChosen,
    #[msg("Missing pending winner")]
    NoPendingWinner,
    #[msg("Caller is not the recorded winner")]
    UnauthorizedClaim,
    #[msg("Nothing to pay out")]
    NothingToPayout,
    #[msg("Only the vault authority can finalize the payout")]
    UnauthorizedFinalize,
}
