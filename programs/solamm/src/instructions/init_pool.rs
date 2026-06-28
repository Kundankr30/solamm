use crate::error::AmmCode;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(
        init,
        payer = payer,
        space = Pool::LEN,
        seeds = [b"pool",mint_a.key().as_ref(),mint_b.key().as_ref()],
        bump,
        constraint = mint_a.key() < mint_b.key() @ AmmCode::InvalidMintOrder

    )]
    pub pool: Account<'info, Pool>,
    pub mint_a: Account<'info, Mint>,
    pub mint_b: Account<'info, Mint>,
    //vault A (PDA Token Account)
    #[account(
        init,
        payer=payer,
        token::mint=mint_a,
        token::authority=authority,
        seeds=[b"vault_a",pool.key().as_ref()],
        bump,
    )]
    pub vault_a: Account<'info, TokenAccount>,
    //Vault B (PDA Token Account)
    #[account(
        init,
        payer=payer,
        token::mint=mint_b,
        token::authority = authority,
        seeds = [b"vault_b",pool.key().as_ref()],
        bump,
    )]
    pub vault_b: Account<'info, TokenAccount>,

    #[account(
        init,
        payer=payer,
        mint::decimals = 6,
        mint::authority = authority,
        seeds = [b"lp_mint",pool.key().as_ref()],
        bump,
    )]
    pub lp_mint: Account<'info, Mint>,
    /// CHECK
    #[account(
        seeds = [b"authority",pool.key().as_ref()],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
pub fn handler(ctx: Context<InitPool>, fee_bps: u64) -> Result<()> {
    require!(fee_bps < 10000, AmmCode::InvalidFee);
    let pool = &mut ctx.accounts.pool;
    pool.mint_a = ctx.accounts.mint_a.key();
    pool.mint_b = ctx.accounts.mint_b.key();
    pool.vault_a = ctx.accounts.vault_a.key();
    pool.vault_b = ctx.accounts.vault_b.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.authority = ctx.accounts.authority.key();
    pool.fee_bps = fee_bps;
    // Save the canonical bumps
    pool.bump = ctx.bumps.pool;
    pool.authority_bump = ctx.bumps.authority;
    pool.lp_mint_bump = ctx.bumps.lp_mint;
    Ok(())
}
