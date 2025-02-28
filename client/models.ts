
  
  export interface Raffle {
  raffle_state: number; // u8
  is_unlimited_participant_allowed: number; // u8
  multiple_participation_allowed: number; // u8
  initializer: number[]; // u8[32]
  reward_mint: number[]; // u8[32]
  raffle_name: number[]; // u8[32]
  raffle_no: bigint; // u64
  current_number_of_participants: bigint; // u64
  participants_required: bigint; // u64
  participation_fee: bigint; // u64
  participation_fee_mint: number[]; // u8[32]
  participation_fee_type: bigint; // u64
  rewards: bigint[]; // Vec<u64>
  winners: bigint[]; // Vec<u64>
  requirement_to_participate: number; // u8
  requirement_amount_token: bigint; // u64
  requirement_nft_mint: number[]; // u8[32]
  reward_decimals: number; // u8
  participation_fee_decimals: number; // u8
  raffle_time: bigint; // u64
  winner_count: bigint; // u64
  current_winner_count: bigint; // u64
  number_of_entitled_winners: bigint; // u64
  }
  export const RaffleSchema = {
  struct: {
    raffle_state: 'u8',
    is_unlimited_participant_allowed: 'u8',
    multiple_participation_allowed: 'u8',
    'initializer': { array: { type: 'u8', length: 32 } },
    'reward_mint': { array: { type: 'u8', length: 32 } },
    'raffle_name': { array: { type: 'u8', length: 32 } },
    raffle_no: 'u64',
    current_number_of_participants: 'u64',
    participants_required: 'u64',
    participation_fee: 'u64',
    'participation_fee_mint': { array: { type: 'u8', length: 32 } },
    participation_fee_type: 'u64',
    'rewards': { array: { type: 'u64' } },
    'winners': { array: { type: 'u64' } },
    requirement_to_participate: 'u8',
    requirement_amount_token: 'u64',
    'requirement_nft_mint': { array: { type: 'u8', length: 32 } },
    reward_decimals: 'u8',
    participation_fee_decimals: 'u8',
    raffle_time: 'u64',
    winner_count: 'u64',
    current_winner_count: 'u64',
    number_of_entitled_winners: 'u64',
  },
  };
  
  export interface Participant {
  particpant_address: number[]; // u8[32]
  particpant_no: bigint; // u64
  raffle_no: bigint; // u64
  entitled: number; // u8
  prize_claimed: number; // u8
  index_in_winners: bigint; // u64
  }
  export const ParticipantSchema = {
  struct: {
    particpant_address: { array: { type: 'u8', length: 32 } },
    particpant_no: 'u64',
    raffle_no: 'u64',
    entitled: 'u8',
    prize_claimed: 'u8',
    index_in_winners: 'u64',
  },
  };
  
  export interface Term {
  initialized: number; // u8
  fee_percent: bigint; // u64
  expiration_time: bigint; // u64
  maximum_winner_count: bigint; // u64
  }
  export const TermSchema = {
  struct: {
    initialized: 'u8',
    fee_percent: 'u64',
    expiration_time: 'u64',
    maximum_winner_count: 'u64',
  },
  };
  
  export interface Config {
  authority_1: number[]; // u8[32]
  authority_2: number[]; // u8[32]
  authority_3: number[]; // u8[32]
  authority_4: number[]; // u8[32]
  }
  export const ConfigSchema = {
  struct: {
    'authority_1': { array: { type: 'u8', length: 32 } },
    'authority_2': { array: { type: 'u8', length: 32 } },
    'authority_3': { array: { type: 'u8', length: 32 } },
    'authority_4': { array: { type: 'u8', length: 32 } },
  },
  };

  export const InitRaffleSchema = { 
    struct: { 
      is_unlimited_participant_allowed:'u8',
      'raffle_name':{ array: { type: 'u8',length:32 }},
      participation_fee:'u64',
      participants_required:'u64',
      raffle_time:'u64',
      multiple_participation_allowed:'u8',
      participation_fee_type:'u64',
      reward_type:'u64',
      'rewards':{ array: { type: 'u64' }},
      requirement_to_participate:'u8',
      requirement_amount_token:'u64',
      requirement_nft_mint:{ array: { type: 'u8',length:32 }},
      'winner_count':{ array: { type: 'u64' }}
  }
  };
  export interface InitRaffle {
    is_unlimited_participant_allowed: number; // u8
    raffle_name: number[]; // u8[32]
    participation_fee: bigint; // u64
    participants_required: bigint; // u64
    raffle_time: bigint; // u64
    multiple_participation_allowed: number; // u8
    participation_fee_type: bigint; // u64
    reward_type: bigint; // u64
    rewards: bigint[]; // u64[]
    requirement_to_participate: number; // u8
    requirement_amount_token: bigint; // u64
    requirement_nft_mint: number[]; // u8[32]
    winner_count: bigint[]; // u64[]
  }

  export const CounterSchema = { 
    struct: { 
    initialized: 'u8', 
    number_of_raffles: 'u64', 
  }
  };
  export interface Counter  { 
    initialized: number, 
    number_of_raffles: bigint, 
  }

  
  export interface RewardFeeType {
  mint: number[]; // u8[32]
  decimals: number; // u8
  no: bigint; // u64
  }
  export const RewardFeeTypeSchema = {
  struct: {
    'mint': { array: { type: 'u8', length: 32 } },
    decimals: 'u8',
    no: 'u64',
  },
  };

  export interface RaffleNameData {
    raffle_name: number[]; // u8[32]
  }  
  export const RaffleNameSchema = {
    struct: {
      'raffle_name': { array: { type: 'u8', length: 32 } },
    },
  };