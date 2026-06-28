use crate::error::AmmCode;
use anchor_lang::prelude::*;
pub fn calculate_initial_lp(amount_a: u64, amount_b: u64) -> Result<u64> {
    let product = (amount_a as u128)
        .checked_mul(amount_b as u128)
        .ok_or(AmmCode::MathOverflow)?;

    let lp = isqrt(product);
    require!(lp > 0, AmmCode::ZeroLiquidity);
    Ok(lp)
}

// Babylonian method
fn isqrt(n: u128) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x as u64
}

pub fn calculate_lp_tokens(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
    lp_supply: u64,
) -> Result<u64> {
    let lp_a = (amount_a as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_div(reserve_a as u128)
        .ok_or(AmmCode::MathOverflow)?; // floor

    let lp_b = (amount_b as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_div(reserve_b as u128)
        .ok_or(AmmCode::MathOverflow)?; // floor

    let lp = lp_a.min(lp_b);
    require!(lp > 0, AmmCode::ZeroLiquidity);
    Ok(lp as u64)
}

pub fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee_bps: u64,
) -> Result<u64> {
    if amount_in == 0 {
        return err!(AmmCode::ZeroAmount);
    }
    // otherwise x*y=k will break
    if reserve_in == 0 || reserve_out == 0 {
        return err!(AmmCode::ZeroLiquidity);
    }

    // (x+del x).(y+del y) = k after trade - eqn 1
    // x.y = k - eqn 2
    // by solving we get del(y) = y*del(x) / (x+del(x))
    let fee_multiplier = (10_000u128)
        .checked_sub(fee_bps as u128)
        .ok_or(AmmCode::MathOverflow)?;

    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(fee_multiplier)
        .ok_or(AmmCode::MathOverflow)?;

    let nume = (reserve_out as u128)
        .checked_mul(amount_in_with_fee)
        .ok_or(AmmCode::MathOverflow)?;

    let deno = (reserve_in as u128)
        .checked_mul(10_000u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_add(amount_in_with_fee)
        .ok_or(AmmCode::MathOverflow)?;

    let amount_out = nume.checked_div(deno).ok_or(AmmCode::MathOverflow)?;

    if amount_out == 0 {
        return err!(AmmCode::InsufficientLiquidity);
    }

    Ok(amount_out as u64)
}
pub fn tokens_on_withdraw(
    lp_amount: u64,
    reserve_a: u64,
    reserve_b: u64,
    lp_supply: u64,
) -> Result<(u64, u64)> {
    require!(lp_amount > 0 && lp_supply > 0, AmmCode::ZeroLiquidity);

    let lp = lp_amount as u128;
    let supply = lp_supply as u128;

    let a_out = lp
        .checked_mul(reserve_a as u128)
        .ok_or(AmmCode::MathOverflow)?
        / supply; // floor — favors pool

    let b_out = lp
        .checked_mul(reserve_b as u128)
        .ok_or(AmmCode::MathOverflow)?
        / supply; // floor — favors pool

    require!(a_out > 0 && b_out > 0, AmmCode::InsufficientLiquidity);

    Ok((a_out as u64, b_out as u64))
}
