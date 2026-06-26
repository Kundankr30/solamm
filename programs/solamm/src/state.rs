use anchor_lang::prelude::*;
#[account]
pub struct Pool {
    pub mint_a: Pubkey, //for token a
    pub mint_b: Pubkey, //for token b
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub lp_mint: Pubkey,   //liquidity tracking
    pub authority: Pubkey, //signer
    //all above 32 bytes
    pub fee_bps: u64,       //8bytes
    pub bump: u8,           //1bytes
    pub authority_bump: u8, //1bytes
    pub lp_mint_bump: u8,   //1bytes
}
impl Pool {
    pub const LEN: usize = 32 * 6 + 8 + 3;
}
