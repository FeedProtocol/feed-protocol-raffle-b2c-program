import { Keypair, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import bs58 from 'bs58';


//export const raffle_program = new PublicKey("1zStXFfLReao29nQL3saNAdH8S5oVcEVwzorBX37aPa") B2B

export const raffle_program = new PublicKey("H7gQ6ueKQbPMYLnLyxFYxr1hFFLKHDyyMD9Q8MJHuGHm") //B2C
export const rng_program = new PublicKey("FEED1qspts3SRuoEyG29NMNpsTKX8yG9NGMinNC4GeYB");
export const entropy_account = new PublicKey("CTyyJKQHo6JhtVYBaXcota9NozebV3vHF872S8ag2TUS");
export const rng_program_fee_account = new PublicKey("WjtcArL5m5peH8ZmAdTtyFF9qjyNxjQ2qp4Gz1YEQdy");

export const token_mint = new PublicKey("4pnJLwuTL4cn5soLhnGF1YqbCEAWJUmUKwJnNX9PuaMH");

dotenv.config();

const participant_1_str= process.env.PARTICIPANT_0
const participant_2_str= process.env.PARTICIPANT_1
const participant_3_str= process.env.PARTICIPANT_2
const participant_4_str= process.env.PARTICIPANT_3
const participant_5_str= process.env.PARTICIPANT_4
const participant_6_str= process.env.PARTICIPANT_5
const participant_7_str= process.env.PARTICIPANT_6
const participant_8_str= process.env.PARTICIPANT_7
const participant_9_str= process.env.PARTICIPANT_8
const participant_10_str = process.env.PARTICIPANT_9
const participant_11_str = process.env.PARTICIPANT_10
const participant_12_str = process.env.PARTICIPANT_11
const participant_13_str = process.env.PARTICIPANT_12
const participant_14_str = process.env.PARTICIPANT_13
const participant_15_str = process.env.PARTICIPANT_14
const participant_16_str = process.env.PARTICIPANT_15
const participant_17_str = process.env.PARTICIPANT_16
const participant_18_str = process.env.PARTICIPANT_17
const participant_19_str = process.env.PARTICIPANT_18
const participant_20_str = process.env.PARTICIPANT_19
const raffle_organizer_str = process.env.RAFFLE_ORGANIZER
const fee_type_mint_str = process.env.FEEMINT
const reward_type_mint_str = process.env.REWARDMINT
const required_type_mint_str = process.env.REQMINT
const auth_0_str = process.env.AUTH_0
const auth_1_str = process.env.AUTH_1
const auth_2_str = process.env.AUTH_2
const auth_3_str = process.env.AUTH_3

export const participant_1 = Keypair.fromSecretKey(bs58.decode(participant_1_str!));
export const participant_2 = Keypair.fromSecretKey(bs58.decode(participant_2_str!));
export const participant_3 = Keypair.fromSecretKey(bs58.decode(participant_3_str!));
export const participant_4 = Keypair.fromSecretKey(bs58.decode(participant_4_str!));
export const participant_5 = Keypair.fromSecretKey(bs58.decode(participant_5_str!));
export const participant_6 = Keypair.fromSecretKey(bs58.decode(participant_6_str!));
export const participant_7 = Keypair.fromSecretKey(bs58.decode(participant_7_str!));
export const participant_8 = Keypair.fromSecretKey(bs58.decode(participant_8_str!));
export const participant_9 = Keypair.fromSecretKey(bs58.decode(participant_9_str!));
export const participant_10 = Keypair.fromSecretKey(bs58.decode(participant_10_str!));
export const participant_11 = Keypair.fromSecretKey(bs58.decode(participant_11_str!));
export const participant_12 = Keypair.fromSecretKey(bs58.decode(participant_12_str!));
export const participant_13 = Keypair.fromSecretKey(bs58.decode(participant_13_str!));
export const participant_14 = Keypair.fromSecretKey(bs58.decode(participant_14_str!));
export const participant_15 = Keypair.fromSecretKey(bs58.decode(participant_15_str!));
export const participant_16 = Keypair.fromSecretKey(bs58.decode(participant_16_str!));
export const participant_17 = Keypair.fromSecretKey(bs58.decode(participant_17_str!));
export const participant_18 = Keypair.fromSecretKey(bs58.decode(participant_18_str!));
export const participant_19 = Keypair.fromSecretKey(bs58.decode(participant_19_str!));
export const participant_20 = Keypair.fromSecretKey(bs58.decode(participant_20_str!));

export const raffle_organizer = Keypair.fromSecretKey(bs58.decode(raffle_organizer_str!));

export const authority_0 = Keypair.fromSecretKey(bs58.decode(auth_0_str!));
export const authority_1 = Keypair.fromSecretKey(bs58.decode(auth_1_str!));
export const authority_2 = Keypair.fromSecretKey(bs58.decode(auth_2_str!));
export const authority_3 = Keypair.fromSecretKey(bs58.decode(auth_3_str!));

export const reward_type_mint_keypair = Keypair.fromSecretKey(bs58.decode(reward_type_mint_str!));
export const fee_type_mint_keypair = Keypair.fromSecretKey(bs58.decode(fee_type_mint_str!));
export const required_type_mint_keypair = Keypair.fromSecretKey(bs58.decode(required_type_mint_str!));

export const reward_type_mint =  reward_type_mint_keypair.publicKey;
export const fee_type_mint = fee_type_mint_keypair.publicKey;
export const required_type_mint = required_type_mint_keypair.publicKey;


export const participants:Keypair[] = [participant_1,participant_2,participant_3,participant_4,
    participant_5,participant_6,participant_7,participant_8,participant_9,participant_10,participant_11,
    participant_12,participant_13,participant_14,participant_15,participant_16,participant_17,
    participant_18,participant_19,participant_20,
]

