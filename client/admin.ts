  import {
    Keypair,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    SYSVAR_EPOCH_SCHEDULE_PUBKEY,
    SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
    AccountMeta,
    ComputeBudgetInstruction,
    ComputeBudgetProgram,
  } from "@solana/web3.js";

  import * as borsh from "borsh";
  import { Counter, CounterSchema, InitRaffle, InitRaffleSchema, RewardFeeType, RewardFeeTypeSchema, RSchema  } from "./models";
  import { connection} from './connection';
  import { raffle_program, } from "./accounts"
  import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
  import { numberToLEBytes8, stringToNumberArray32Bytes } from "./utils";
  import { get_token_program_and_decimals } from "./get_info";

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  export const init_raffle = async (
    initializer:Keypair, 
    is_unlimited_participant_allowed:number,
    raffle_name_str:string,
    fee:number,
    participants_required:bigint,
    raffle_time:bigint,
    multiple_participation_allowed:number,
    participation_fee_type:bigint,
    reward_type:bigint,
    rewards_number:number[],
    requirement_to_participate:number,
    required_token_amount:number,
    requirement_token_mint:PublicKey,
    winner_count:bigint,
    is_increasing_pool:number,
    transfer_fee_to_pool:bigint[]
    ) => {


       const counter_account = PublicKey.findProgramAddressSync([Buffer.from("counter")],raffle_program)[0]

       const counter_info = await connection.getAccountInfo(counter_account);

       const counter = borsh.deserialize(CounterSchema,counter_info?.data!) as Counter;

       counter.number_of_raffles = BigInt(Number(counter.number_of_raffles) + 1);

       const le_bytes = numberToLEBytes8(counter.number_of_raffles)

       const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]

       const raffle_name:number[] = stringToNumberArray32Bytes(raffle_name_str)!;


       const fee_tyepe_le_bytes = numberToLEBytes8(participation_fee_type)
       const rew_tyepe_le_bytes = numberToLEBytes8(reward_type)

       const fee_type_account = PublicKey.findProgramAddressSync([Buffer.from("feetype"),Buffer.from(fee_tyepe_le_bytes)],raffle_program)[0];
       console.log(`fee_type_account ${fee_type_account.toBase58()}`);
       const fee_type_account_info = await connection.getAccountInfo(fee_type_account)

       const rew_type_account = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),Buffer.from(rew_tyepe_le_bytes)],raffle_program)[0];
       console.log(`rew_tyepe_le_bytes ${rew_type_account.toBase58()}`);
       const rew_type_account_info = await connection.getAccountInfo(rew_type_account)

       const fee_type = borsh.deserialize(RewardFeeTypeSchema,fee_type_account_info?.data!) as RewardFeeType;
       const rew_type = borsh.deserialize(RewardFeeTypeSchema,rew_type_account_info?.data!) as RewardFeeType;

       const fee_mint = new PublicKey(fee_type.mint);
       const reward_mint = new PublicKey(rew_type.mint);
       

       console.log("fee mint "+fee_mint.toBase58())
       console.log("fee mint "+fee_type.mint)
       console.log("fee mint "+fee_type.no)
       console.log("reward_mint "+reward_mint.toBase58())
       console.log("reward_mint "+rew_type.mint)
       console.log("reward_mint "+rew_type.no)

       const reward_mint_decimals = rew_type.decimals;

       let required_token_decimals:number =0;
       let required_mint_token_program:PublicKey = SystemProgram.programId;
       if(requirement_to_participate == 1) {
        console.log("req_token_condition");
        [required_mint_token_program,required_token_decimals] = await get_token_program_and_decimals(requirement_token_mint);
         
       } 

       const requirement_mint:number[] = Array.from(requirement_token_mint.toBytes())

       const powerOfTen_reward_mint = Math.pow(10, reward_mint_decimals)

       let fee_decimals = fee_type.decimals;
       const powerOfTen_fee_mint = Math.pow(10, fee_decimals);

       const powerOfTen_requirement = Math.pow(10, required_token_decimals)
       const requirement_amount_token = BigInt(required_token_amount*powerOfTen_requirement)
        

       const rewards:bigint[] = [];
       for (let index = 0; index < rewards_number.length; index++) {
        const element = BigInt(rewards_number[index]*powerOfTen_reward_mint);
        rewards.push(element)
       }
       const participation_fee:bigint = BigInt(powerOfTen_fee_mint*fee);


       const initRaffleData = {
        is_unlimited_participant_allowed,
        raffle_name,
        participation_fee,
        participants_required,
        raffle_time,
        multiple_participation_allowed,
        participation_fee_type,
        reward_type,
        rewards,
        requirement_to_participate,
        requirement_amount_token,
        requirement_mint,
        required_token_decimals,
        winner_count,
        is_increasing_pool,
        transfer_fee_to_pool
       };


       const serialized = borsh.serialize(InitRaffleSchema, initRaffleData);

       const deserialized = borsh.deserialize(InitRaffleSchema,serialized) as InitRaffle;

       console.log(deserialized.participation_fee_type)
       console.log(participation_fee_type)
       console.log(deserialized.reward_type)

       const concated = Uint8Array.of(0, ...serialized);

       const initializer_ata = getAssociatedTokenAddressSync(
        reward_mint,
        initializer.publicKey,
        false,
        TOKEN_PROGRAM_ID!,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const raffle_reward_ata = getAssociatedTokenAddressSync(
        reward_mint,
        raffle_pda,
        true,
        TOKEN_PROGRAM_ID!,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const raffle_fee_ata = getAssociatedTokenAddressSync(
        fee_mint,
        raffle_pda,
        true,
        TOKEN_PROGRAM_ID!,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    const fee_type_no_serialized = numberToLEBytes8(participation_fee_type)
    const reward_type_no_serialized = numberToLEBytes8(reward_type)

    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];
    const reward_type_pda = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),reward_type_no_serialized], raffle_program)[0];
    const fee_type_pda = PublicKey.findProgramAddressSync([Buffer.from("feetype"),fee_type_no_serialized], raffle_program)[0];


     const keys:AccountMeta[] = [];

     const initializer_meta:AccountMeta = { isSigner: true, isWritable: true, pubkey: initializer.publicKey };
     const initializer_ata_meta:AccountMeta = { isSigner: false, isWritable: true, pubkey: initializer_ata };
     const raffle_pda_meta:AccountMeta = { isSigner: false, isWritable: true, pubkey: raffle_pda };
     const raffle_reward_ata_meta:AccountMeta = { isSigner: false, isWritable: true, pubkey: raffle_reward_ata };
     const raffle_fee_ata_meta:AccountMeta = { isSigner: false, isWritable: true, pubkey: raffle_fee_ata };
     const counter_account_meta:AccountMeta = { isSigner: false, isWritable: true, pubkey: counter_account };
     const term_account_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: term_account };
     const reward_type_pda_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: reward_type_pda };
     const fee_type_pda_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: fee_type_pda };
     const reward_mint_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: reward_mint };
     const reward_mint_token_program_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID };
     const fee_mint_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: fee_mint };
     const fee_mint_token_program_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID };
     const SYSVAR_RENT_PUBKEY_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY };
     const SystemProgram_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId };
     const ASSOCIATED_TOKEN_PROGRAM_ID_meta:AccountMeta = { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID };
     
     
     keys.push(initializer_meta)
     keys.push(initializer_ata_meta)
     keys.push(raffle_pda_meta)
     keys.push(raffle_reward_ata_meta)
     keys.push(raffle_fee_ata_meta)
     keys.push(counter_account_meta)
     keys.push(term_account_meta)
     keys.push(reward_type_pda_meta)
     keys.push(fee_type_pda_meta)
     keys.push(reward_mint_meta)
     keys.push(reward_mint_token_program_meta)
     keys.push(fee_mint_meta)
     keys.push(fee_mint_token_program_meta)
     keys.push(SYSVAR_RENT_PUBKEY_meta)



     if(requirement_to_participate == 1){
      const required_token_ata = getAssociatedTokenAddressSync(requirement_token_mint,raffle_pda,true,required_mint_token_program!,ASSOCIATED_TOKEN_PROGRAM_ID)
      
      //let raffle_reqired_token_ata
      //let required_token_mint
      //let required_mint_token_program

      const required_token_ata_meta:AccountMeta = {isSigner: false, isWritable: true, pubkey: required_token_ata}
      const required_token_mint_meta:AccountMeta = {isSigner: false, isWritable: false, pubkey: requirement_token_mint}
      const raffle_token_program_meta:AccountMeta = {isSigner: false, isWritable: false, pubkey: required_mint_token_program!}

      keys.push(required_token_ata_meta)
      keys.push(required_token_mint_meta)
      keys.push(raffle_token_program_meta)
     }

     keys.push(SystemProgram_meta)
     keys.push(ASSOCIATED_TOKEN_PROGRAM_ID_meta)

     const computeBudgetIx1 = ComputeBudgetProgram.setComputeUnitLimit({units:500000});
      
       const ix = new TransactionInstruction({
         programId: raffle_program,
         keys,
         data: Buffer.from(concated)
       });

       const message = new TransactionMessage({
         instructions: [computeBudgetIx1,ix],
         payerKey: initializer.publicKey,
         recentBlockhash: (await connection.getLatestBlockhash()).blockhash
       }).compileToV0Message();


       const tx = new VersionedTransaction(message);
       tx.sign([initializer]);

       const sig = await connection.sendTransaction(tx);



  return delay(600)
}

  export const collect_fee_initializer = async (raffle_no:bigint, initializer:Keypair) => {


    const le_bytes = numberToLEBytes8(raffle_no)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]


    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];

    const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];

    

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: initializer.publicKey },
        { isSigner: false, isWritable: true, pubkey: raffle_pda },
        { isSigner: false, isWritable: true, pubkey: term_account },
        { isSigner: false, isWritable: true, pubkey: fee_collector_account },
   ],
      data: Buffer.from([200])
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: initializer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([initializer]);

    const sig = connection.sendTransaction(tx);

    console.log(sig)
  return delay(600)
}

  export const collect_fee_token_initializer = async (raffle_no:bigint, initializer:Keypair, mint:PublicKey) => {


    const le_bytes = numberToLEBytes8(raffle_no)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]


    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];

    const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];
console.log(fee_collector_account.toBase58())
    const mint_info = await connection.getAccountInfo(mint)

    const token_program = mint_info!.owner

    const fee_collector_ata = getAssociatedTokenAddressSync(mint,fee_collector_account,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
    const raffle_ata = getAssociatedTokenAddressSync(mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
    const initializer_ata = getAssociatedTokenAddressSync(mint,initializer.publicKey,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: initializer.publicKey },
        { isSigner: false, isWritable: true, pubkey: raffle_pda },
        { isSigner: false, isWritable: false, pubkey: term_account },
        { isSigner: false, isWritable: true, pubkey: fee_collector_account },
        { isSigner: false, isWritable: true, pubkey: fee_collector_ata },
        { isSigner: false, isWritable: true, pubkey: initializer_ata },
        { isSigner: false, isWritable: true, pubkey: raffle_ata },
        { isSigner: false, isWritable: false, pubkey: token_program },
        { isSigner: false, isWritable: false, pubkey: mint },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
        { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
   ],
      data: Buffer.from([200])
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: initializer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([initializer]);

    const sig = connection.sendTransaction(tx);

    console.log(sig)
  return delay(600)
}

  export const freeze_test = async (raffle_no:bigint, initializer:Keypair,participant:Keypair, participation_fee_mint:PublicKey,x:bigint) => {


  const le_bytes = numberToLEBytes8(raffle_no)

  const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]


  const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];

  const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];
  console.log(fee_collector_account.toBase58())
  const mint_info = await connection.getAccountInfo(participation_fee_mint)

  const token_program = mint_info!.owner

  const ata = getAssociatedTokenAddressSync(participation_fee_mint,participant.publicKey,false,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID)

  const r = {
    x
  }

  const serialized = borsh.serialize(RSchema, r);

  const concated = Uint8Array.of(255, ...serialized);


  
  const ix = new TransactionInstruction({
    programId: raffle_program,
    keys: [
      { isSigner: true, isWritable: true, pubkey: initializer.publicKey },
      { isSigner: false, isWritable: false, pubkey: raffle_pda },
      { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
      { isSigner: false, isWritable: true, pubkey: participation_fee_mint },
      { isSigner: false, isWritable: false, pubkey: ata },
      { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },

 ],
    data: Buffer.from(concated)
  });

  const message = new TransactionMessage({
    instructions: [ix],
    payerKey: initializer.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([initializer]);

  const sig = connection.sendTransaction(tx);

  console.log(sig)
return delay(600)
}

