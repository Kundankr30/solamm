use crate::error::AmmCode;
use crate::math::calculate_swap_output;
use crate::state::Pool;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        has_one = vault_a,
        has_one = vault_b,
        has_one = authority,
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut)]
    ///CHECK
    #[account(seeds = [b"authority",pool.key().as_ref()],bump=pool.authority_bump)]
    pub authority: UncheckedAccount<'info>,
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
pub fn swap_handler(
    ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    a_to_b: bool,
) -> Result<()> {
    let (reserve_in, reserve_out) = if a_to_b {
        (ctx.accounts.vault_a.amount, ctx.accounts.vault_b.amount)
    } else {
        (ctx.accounts.vault_b.amount, ctx.accounts.vault_a.amount)
    };
    let amount_out = calculate_swap_output(
        amount_in,
        reserve_in,
        reserve_out,
        ctx.accounts.pool.fee_bps,
    )?;
    require!(amount_out >= min_amount_out, AmmCode::SlippageExceeded);
    if a_to_b {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: ctx.accounts.vault_a.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;
    } else {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.user_token_b.to_account_info(),
                    to: ctx.accounts.vault_b.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;
    }
    let pool_key = ctx.accounts.pool.key();
    let authority_bump = ctx.accounts.pool.authority_bump;
    let seeds: &[&[u8]] = &[b"authority", pool_key.as_ref(), &[authority_bump]];
    let signer = &[seeds];
    if a_to_b {
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
            amount_out,
        )?;
    } else {
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
            amount_out,
        )?;
    }
    Ok(())
}
