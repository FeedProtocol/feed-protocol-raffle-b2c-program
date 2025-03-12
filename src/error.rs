use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum RaffleProgramError {
  /// Invalid Instruction
  #[error("Invalid Instruction")]//0
  InvalidInstruction,

  #[error("arithmetic error")]//1
  ArithmeticError,

  #[error("counter account is invalid")]//2
  InvalidCounter,
  
  #[error("current raffle initializer is invalid")]//3
  InvalidInitializer,

  #[error("raffle account is invalid")]//4
  InvalidRaffle,

  #[error("initializer account is not signer")]//5
  InitializerNotSigner,

  #[error("derived pda address and winner pda does not match")]//6
  InvalidWinnerPDA,

  #[error("participant no and raffle winner no does not match")]//7
  InvalidWinnerNo,
  
  #[error("participant raffle no and raffle no does not match")]//8
  InvalidRaffleNo,

  #[error("participant pda doesnt belong to program")]//9
  InvalidParticipantPDA,


  #[error("raffle state is invalid")]//10
  InvalidRaffleState,

  #[error("participant account is not signer")]//11
  ParticipantNotSigner,

  #[error("required numbers of participants reached")]//12
  MaxNumberReached,

  #[error("invalid winner pda")]//13
  InvalidWinner,

  #[error("invalid fee account")]//14
  InvalidFee,


  #[error("invalid config account")]//15
  InvalidConfig,
  
  #[error("authority not signer ")]//16
  NotSignerAuth,

  #[error("invalid authority account")]//17
  InvalidAuth,

  #[error("invalid temrs account")]//18
  InvalidTerms,

  #[error("invalid raffle time")]//19
  InvalidRaffleTime,

  #[error("account should not be writable")]//20
  WritableAccount,

  #[error("reward type account is invalid")]//21
  InvalidRewardType,

  #[error("fee type account is invalid")]//22
  InvalidFeeType,

  #[error("invalid maximum number of winners")]//23
  InvalidWinnerNumber,

  #[error("rng program failed")]//24
  RNGProgramError,

  #[error("invalid mint")]//25
  InvalidMint,

}

impl From<RaffleProgramError> for ProgramError {
  fn from(e: RaffleProgramError) -> Self {
    ProgramError::Custom(e as u32)
  }
}
