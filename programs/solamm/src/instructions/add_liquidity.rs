use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        has_one = vault_a,
        has_one = vault_b,
        has_one = lp_mint,
        has_one = authority,
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub vault_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [b"authority", pool.key().as_ref()], bump)]
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_lp_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
