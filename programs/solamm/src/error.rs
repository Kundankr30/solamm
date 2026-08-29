use anchor_lang::prelude::*;

#[error_code]
pub enum AmmCode {
    #[msg("The input amount cannot be zero")]
    ZeroAmount,

    #[msg("The pool has zero liquidity. Initial deposit required.")]
    ZeroLiquidity,

    #[msg("Insufficient liquidity in the pool for this operation.")]
    InsufficientLiquidity,

    #[msg("A math overflow occurred. The numbers got too big.")]
    MathOverflow,

    #[msg("Invalid mint order. Mint A must be mathematically less than Mint B.")]
    InvalidMintOrder,

    #[msg("Fee must be less than 10,000 basis points (100%).")]
    InvalidFee,

    #[msg("Slippage tolerance exceeded. Minimum output not reached.")]
    SlippageExceeded,

    #[msg("Invalid token account owner.")]
    InvalidOwner,

    #[msg("Invalid token account mint.")]
    InvalidMint,
}
