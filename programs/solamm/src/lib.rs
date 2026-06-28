pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

declare_id!("9RnLR4wcfRqNc7abzqbTxK18Z8Rwv82Y9f4d5Zn36trn");

pub use instructions::*;
// pub(crate) use instructions::{
//     __client_accounts_add_liquidity, __client_accounts_init_pool,
//     __client_accounts_remove_liquidity,
// };

#[program]
pub mod solamm {
    use super::*;

    pub fn init_pool(ctx: Context<InitPool>, fee_bps: u64) -> Result<()> {
        instructions::init_pool::handler(ctx, fee_bps)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_out: u64,
    ) -> Result<()> {
        instructions::add_liquidity::add_liquidity_handler(ctx, amount_a, amount_b, min_lp_out)
    }
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
        min_a_out: u64,
        min_b_out: u64,
    ) -> Result<()> {
        instructions::remove_liquidity::remove_liquidity_handler(
            ctx, lp_amount, min_a_out, min_b_out,
        )
    }
}
