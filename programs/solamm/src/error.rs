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
}
