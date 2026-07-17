use crate::{
    error::AmmCode,
    math::{calculate_initial_lp, calculate_lp_tokens},
    state::Pool,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer};
#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    /// CHECK:
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

    /// CHECK: PDA authority derived from the pool account and validated by seeds.
    #[account(seeds = [b"authority", pool.key().as_ref()], bump = pool.authority_bump)]
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

pub fn add_liquidity_handler(
    ctx: Context<AddLiquidity>,
    amount_a: u64,
    amount_b: u64,
    min_lp_out: u64,
) -> Result<()> {
    // Verify that user_token_a matches the pool's mint_a and is owned by the signer (user)
    require_keys_eq!(
        ctx.accounts.user_token_a.mint,
        ctx.accounts.pool.mint_a,
        AmmCode::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.user_token_a.owner,
        ctx.accounts.user.key(),
        AmmCode::InvalidOwner
    );

    // Verify that user_token_b matches the pool's mint_b and is owned by the signer (user)
    require_keys_eq!(
        ctx.accounts.user_token_b.mint,
        ctx.accounts.pool.mint_b,
        AmmCode::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.user_token_b.owner,
        ctx.accounts.user.key(),
        AmmCode::InvalidOwner
    );

    // Verify that user_lp_account matches the pool's lp_mint and is owned by the signer (user)
    require_keys_eq!(
        ctx.accounts.user_lp_account.mint,
        ctx.accounts.pool.lp_mint,
        AmmCode::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.user_lp_account.owner,
        ctx.accounts.user.key(),
        AmmCode::InvalidOwner
    );

    let is_first_deposit = ctx.accounts.lp_mint.supply == 0;
    let lp_to_mint = if is_first_deposit {
        calculate_initial_lp(amount_a, amount_b)?
    } else {
        calculate_lp_tokens(
            amount_a,
            amount_b,
            ctx.accounts.vault_a.amount,
            ctx.accounts.vault_b.amount,
            ctx.accounts.lp_mint.supply,
        )?
    };
    require!(lp_to_mint >= min_lp_out, AmmCode::SlippageExceeded);
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_token_a.to_account_info(),
                to: ctx.accounts.vault_a.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a,
    )?;
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_token_b.to_account_info(),
                to: ctx.accounts.vault_b.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_b,
    )?;
    let pool_key = ctx.accounts.pool.key();
    let authority_bump = ctx.accounts.pool.authority_bump;
    let seeds: &[&[u8]] = &[b"authority", pool_key.as_ref(), &[authority_bump]];
    let signer = &[seeds];
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        ),
        lp_to_mint,
    )?;
    Ok(())
}
