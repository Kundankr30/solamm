use crate::error::AmmCode;
use anchor_lang::prelude::*;
pub fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee_bps: u64,
) -> Result<u64> {
    if amount_in == 0 {
        return err!(AmmCode::ZeroAmount);
    }
    //otherwise x*y=k will berak
    if reserve_in == 0 || reserve_out == 0 {
        return err!(AmmCode::ZeroLiquidity);
    }
    //(x+del x).(y+del y) = k after trade  -eqn 1
    // x.y = k -eqn2
    // by solving we get del(y) = y*del(x)/x+del(x)
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
