use crate::error::AmmCode;
use crate::math::tokens_on_withdraw;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer};
#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
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
    ///CHECK
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
pub fn remove_liquidity_handler(
    ctx: Context<RemoveLiquidity>,
    lp_amount: u64,
    min_a_out: u64,
    min_b_out: u64,
) -> Result<()> {
    let (token_a_out, token_b_out) = tokens_on_withdraw(
        lp_amount,
        ctx.accounts.vault_a.amount,
        ctx.accounts.vault_b.amount,
        ctx.accounts.lp_mint.supply,
    )?;
    require!(token_a_out >= min_a_out, AmmCode::SlippageExceeded);
    require!(token_b_out >= min_b_out, AmmCode::SlippageExceeded);
    burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        lp_amount,
    )?;
    let pool_key = ctx.accounts.pool.key();
    let authority_bump = ctx.accounts.pool.authority_bump;
    let seeds: &[&[u8]] = &[b"authority", pool_key.as_ref(), &[authority_bump]];
    let signer = &[seeds];
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault_a.to_account_info(),
                to: ctx.accounts.user_token_a.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        ),
        token_a_out,
    )?;
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault_b.to_account_info(),
                to: ctx.accounts.user_token_b.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        ),
        token_b_out,
    )?;

    Ok(())
}
