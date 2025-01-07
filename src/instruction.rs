use crate::{error::RaffleProgramError::InvalidInstruction, state::{Term, InitPda, InitRaffle}};
use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;

#[derive(Debug, PartialEq)]
pub enum RaffleProgramInstruction {
    InitRaffle{init_raffle:InitRaffle},
    JoinRaffle,
    ChooseWinner,
    PublishWinner,
    ClaimPrize,
    InitCounter,
    ClosePDA,
    InitTerm{data:InitPda},
    InitConfig,
    SetConfig,
    UpdateTerm{data:Term},
    CollectFee,
    CollectFeeInitializer
}

impl RaffleProgramInstruction {
  pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {

    let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;
    Ok(match tag {
      0 => Self::InitRaffle{
        init_raffle:InitRaffle::try_from_slice(&rest)?
      },
      1 => Self::JoinRaffle,
      2 => Self::ChooseWinner,
      3 => Self::PublishWinner,
      4 => Self::InitCounter,
      5 => Self::ClosePDA,
      6 => Self::InitTerm{
        data:InitPda::try_from_slice(&rest)?
      },
      7 => Self::InitConfig,
      8 => Self::SetConfig,
      9 => Self::UpdateTerm{
        data:Term::try_from_slice(&rest)?
      },
      10 => Self::CollectFee,
      100 => Self::ClaimPrize,
      200 => Self::CollectFeeInitializer,


      _ => return Err(InvalidInstruction.into()),
    })
  }
}
