pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9RnLR4wcfRqNc7abzqbTxK18Z8Rwv82Y9f4d5Zn36trn");

#[program]
pub mod solamm {
    use super::*;
    pub fn init_pool(ctx: Context<InitPool>, fee_bps: u64) -> Result<()> {
        instructions::init_pool::handler(ctx, fee_bps)
    }
    // pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
    //     instructions::add_liquidity::handler(ctx, amount_a, amount_b)
    // }
}
