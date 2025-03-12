use borsh::{BorshDeserialize, BorshSerialize};

    //Participation Fee = Get 2.5% of the fee
    //Rent Fee = 0.0025 SOL = 50 cent
    //Raffle Creation Fee : 0 SOL = 0 USD

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Raffle{
    pub raffle_state:u8,
    pub is_unlimited_participant_allowed:u8,
    pub multiple_participation_allowed:u8,
    pub initializer:[u8;32],
    pub reward_mint:[u8;32],
    pub raffle_name:[u8;32],
    pub raffle_no:u64,
    pub current_number_of_participants:u64,
    pub participants_required:u64,
    pub participation_fee:u64,
    pub participation_fee_mint:[u8;32],  //Type of the fee
    pub participation_fee_type: u64,
    pub rewards:Vec<u64>,  //write the number of tokens to distribute
    pub winners:Vec<u64>,
    pub requirement_to_participate:u8, //0 no req, 1 token
    pub requirement_amount_token:u64,  //
    pub requirement_mint:[u8;32],  //
    pub required_token_decimals:u8,
    pub reward_decimals:u8,
    pub participation_fee_decimals:u8,
    pub is_increasing_pool:u8,
    pub transfer_fee_to_pool:Vec<u64>,
    pub raffle_time:u64,
    pub winner_count: u64,
    pub current_winner_count: u64,
    pub number_of_entitled_winners: u64,
    pub fee_collected:u8,
    pub bump:u8
  }

#[derive(BorshDeserialize, Debug, PartialEq)]
pub struct InitRaffle{
  pub is_unlimited_participant_allowed:u8,
  pub raffle_name:[u8;32],
  pub participation_fee:u64,
  pub participants_required:u64,
  pub raffle_time:u64,
  pub multiple_participation_allowed: u8,
  pub participation_fee_type: u64,
  pub reward_type: u64,
  pub rewards: Vec<u64>,
  pub requirement_to_participate: u8,
  pub requirement_amount_token: u64,
  pub requirement_mint: [u8;32],
  pub required_token_decimals:u8,
  pub winner_count: u64,
  pub is_increasing_pool:u8,
  pub transfer_fee_to_pool:Vec<u64>,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]//48
pub struct Participant{
    pub particpant_address:[u8;32],
    pub particpant_no:u64,
    pub raffle_no:u64,
    pub entitled:u8,
    pub prize_claimed:u8,
    pub index_in_winners:u64
}//58

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]//9
pub struct RaffleCounter{
    pub initialized:u8,
    pub number_of_raffles:u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub struct RandomNumber{
  pub random_number:u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub struct Term{
  pub initialized:u8,
  pub fee_percent:u64,
  pub expiration_time:u64,
  pub maximum_winner_count:u64,
}


#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]//9
pub struct Config{
    pub authority_1:[u8;32],
    pub authority_2:[u8;32],
    pub authority_3:[u8;32],
    pub authority_4:[u8;32],
}


#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct RewardFeeType{
    pub initialized:u8,
    pub mint:[u8;32],
    pub decimals:u8,
    pub no:u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]//9
pub struct FeeCollector{
    pub initialized:u8,
}

#[derive(BorshDeserialize, Debug, PartialEq)]
pub struct Rewards{

  pub rewards: Vec<u64>,

}