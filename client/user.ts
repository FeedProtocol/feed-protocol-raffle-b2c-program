import {
    Keypair,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    LAMPORTS_PER_SOL,
    AccountInfo,
    AccountMeta,
  } from "@solana/web3.js";
  import * as borsh from 'borsh';
  import { Counter, CounterSchema, Raffle, RaffleSchema, InitRaffle, InitRaffleSchema,  } from "./models";
  import {connection} from './connection';
  import { raffle_program, entropy_account, fee_account as rng_program_fee_account, rng_program, token_mint} from "./accounts";
  import { deserialize_raffle_account_data, numberToLEBytes8, stringToNumberArray32Bytes } from "./utils";
  import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
  import { get_all_participation_accounts_by_raffle_no, get_all_raffles, get_participation_account_by_raffle_no_and_winner_no as get_participation_account_by_raffle_no_and_winner_no, get_participation_fee_mint, get_raffle_by_raffle_no, get_terms, get_token_program_and_decimals } from "./get_info";
  import { init_config, init_counter, init_term_account, update_terms } from "./admin";



  const init_raffle = async (
    initializer:Keypair, 
    reward_mint:PublicKey,
    reward_type_no:bigint,
    fee_type_no:bigint,
    is_unlimited_participant_allowed:number,
    raffle_name:string,
    participation_fee:bigint,
    participants_required:bigint,
    raffle_time:bigint,
    multiple_participation_allowed:number,
    participation_fee_type:bigint,
    reward_type:bigint,
    rewards:bigint[],
    requirement_to_participate:number,
    requirement_amount_token:bigint,
    requirement_nft_mint:number[],
    winner_count:bigint[]
    ) => {
  
  
       const counter_account = PublicKey.findProgramAddressSync([Buffer.from("counter")],raffle_program)[0]

       const counter_info = await connection.getAccountInfo(counter_account);

       const counter = borsh.deserialize(CounterSchema,counter_info?.data!) as Counter;

       counter.number_of_raffles = BigInt(Number(counter.number_of_raffles) + 1);

       const le_bytes = numberToLEBytes8(counter.number_of_raffles)

       const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]

       const raffle_name_array = stringToNumberArray32Bytes(raffle_name)

       const token_program = await get_token_program_and_decimals(reward_mint)


       const initRaffleData = {
        is_unlimited_participant_allowed,
        raffle_name_array,
        participation_fee,
        participants_required,
        raffle_time,
        multiple_participation_allowed,
        participation_fee_type,
        reward_type,
        rewards,
        requirement_to_participate,
        requirement_amount_token,
        requirement_nft_mint,
        winner_count
       };


       const serialized = borsh.serialize(InitRaffleSchema, initRaffleData);


       const concated = Uint8Array.of(0, ...serialized);


       const initializer_ata = getAssociatedTokenAddressSync(
        reward_mint,
        initializer.publicKey,
        false,
        token_program,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const raffle_ata = getAssociatedTokenAddressSync(
        reward_mint,
        raffle_pda,
        true,
        token_program,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    const fee_type_no_serialized = numberToLEBytes8(fee_type_no)
    const reward_type_no_serialized = numberToLEBytes8(reward_type_no)

    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];
    const reward_type_pda = PublicKey.findProgramAddressSync([Buffer.from("feetype"),fee_type_no_serialized], raffle_program)[0];
    const fee_type_pda = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),reward_type_no_serialized], raffle_program)[0];


       const ix = new TransactionInstruction({
         programId: raffle_program,
         keys: [
           { isSigner: true, isWritable: true, pubkey: initializer.publicKey },
           { isSigner: false, isWritable: true, pubkey: initializer_ata },
           { isSigner: false, isWritable: true, pubkey: raffle_pda },
           { isSigner: false, isWritable: true, pubkey: raffle_ata },
           { isSigner: false, isWritable: true, pubkey: counter_account },
           { isSigner: false, isWritable: false, pubkey: term_account },
           { isSigner: false, isWritable: false, pubkey: reward_type_pda },
           { isSigner: false, isWritable: false, pubkey: fee_type_pda },
           { isSigner: false, isWritable: false, pubkey: reward_mint },
           { isSigner: false, isWritable: false, pubkey: token_program },
           { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
           { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
           { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
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

       const sig = await connection.sendTransaction(tx);

       console.log("raffle = " + raffle_pda.toBase58())

       console.log(sig)
  }

  const join_raffle = async (raffle_no:bigint, participant:Keypair) => {

    const raffle_no_le_byte = numberToLEBytes8(raffle_no)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),raffle_no_le_byte],raffle_program)[0]

    const raffle_account_info = await connection.getAccountInfo(raffle_pda);

    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    const participant_pda = PublicKey.findProgramAddressSync([
      Buffer.from("raf"),
      raffle_no_le_byte,
      Buffer.from("par"),
      participant.publicKey.toBytes()
    ],raffle_program)[0];


    console.log(participant.publicKey.toBase58())

    const keys:AccountMeta[] = [];

         
    const participant_meta = { isSigner: true, isWritable: true, pubkey: participant.publicKey }
    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda }
    const participant_pda_meta = { isSigner: false, isWritable: true, pubkey: participant_pda }

    keys.push(participant_meta)
    keys.push(raffle_pda_meta)
    keys.push(participant_pda_meta)

    if (raffle.participation_fee_type == BigInt(1)){

        const participation_fee_mint_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }

        keys.push(participation_fee_mint_meta)

    }else{
        const participation_fee_mint = await get_participation_fee_mint(raffle.participation_fee_type)
        const participation_fee_mint_meta = { isSigner: false, isWritable: false, pubkey: participation_fee_mint }
        keys.push(participation_fee_mint_meta)

        const token_program = await get_token_program_and_decimals(participation_fee_mint)
        const participant_ata = getAssociatedTokenAddressSync(participation_fee_mint,participant.publicKey,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
        const raffle_ata = getAssociatedTokenAddressSync(participation_fee_mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

        const participant_ata_meta = { isSigner: false, isWritable: true, pubkey: participant_ata }
        const raffle_ata_meta = { isSigner: false, isWritable: false, pubkey: raffle_ata }
        const token_program_meta = { isSigner: false, isWritable: false, pubkey: token_program }
        const system_program_program_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }

        keys.push(participant_ata_meta)
        keys.push(raffle_ata_meta)
        keys.push(token_program_meta)
        keys.push(system_program_program_meta)

    }
    

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys,
      data: Buffer.from([1])
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: participant.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([participant]);

    const sig = await connection.sendTransaction(tx);


  }

  const call_rng_choose_winner = async (raffle_no:bigint,authority:Keypair) => {

   
    const le_bytes = numberToLEBytes8(raffle_no)
 
    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0];
 
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

    const keys:AccountMeta[] = [];

    const authority_meta = { isSigner: true, isWritable: true, pubkey: authority.publicKey };
    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda };
    const entropy_account_meta = { isSigner: false, isWritable: true, pubkey: entropy_account};
    const rng_program_fee_account_meta = { isSigner: false, isWritable: true, pubkey: rng_program_fee_account };
    const rng_program_meta = { isSigner: false, isWritable: false, pubkey: rng_program };
    const system_program_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId };
    const config_account_meta = { isSigner: false, isWritable: false, pubkey: config_account };

    keys.push(authority_meta)
    keys.push(raffle_pda_meta)
    keys.push(entropy_account_meta)
    keys.push(rng_program_fee_account_meta)
    keys.push(rng_program_meta)
    keys.push(system_program_meta)
    keys.push(config_account_meta)

    const raffle_account_info = await connection.getAccountInfo(raffle_pda);

    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    if (raffle.current_number_of_participants == BigInt(0)){

        const initializer = new PublicKey(raffle.initializer);
        const reward_mint = new PublicKey(raffle.reward_mint);
        const token_program = await get_token_program_and_decimals(reward_mint)
        const initializer_ata = getAssociatedTokenAddressSync(reward_mint,initializer,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
        const raffle_ata = getAssociatedTokenAddressSync(reward_mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)


        const initializer_meta = { isSigner: false, isWritable: true, pubkey: initializer };
        const initializer_ata_meta = { isSigner: false, isWritable: true, pubkey: initializer_ata };
        const raffle_ata_meta = { isSigner: false, isWritable: true, pubkey: raffle_ata};
        const reward_mint_meta = { isSigner: false, isWritable: false, pubkey: reward_mint };
        const token_program_meta = { isSigner: false, isWritable: false, pubkey: token_program };
    
        keys.push(initializer_meta)
        keys.push(initializer_ata_meta)
        keys.push(raffle_ata_meta)
        keys.push(reward_mint_meta)
        keys.push(token_program_meta)
    }
   
     const ix = new TransactionInstruction({
       programId: raffle_program,
       keys,
       data: Buffer.from([2])
     });
   
     const message = new TransactionMessage({
       instructions: [ix],
       payerKey: authority.publicKey,
       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
     }).compileToV0Message();
   
     const tx = new VersionedTransaction(message);
     tx.sign([authority]);
 
     connection.sendTransaction(tx);
  }

  const publish_winner = async (raffle_no:bigint,authority:Keypair) => {


    const le_bytes = numberToLEBytes8(raffle_no)

    const raffle_account = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0];


    const raffle_account_info = await connection.getAccountInfo(raffle_account);
 
    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    const keys:AccountMeta[] = [];
         
    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_account }

    keys.push(raffle_pda_meta)

    for (let index = 0; index < raffle.winners.length; index++) {

        const winner_no = raffle.winners[index];

        const winner_no_bytes = numberToLEBytes8(winner_no);

        if(raffle.multiple_participation_allowed == 1){
            const winner_pda = PublicKey.findProgramAddressSync([Buffer.from("raf"),le_bytes,Buffer.from("par"),winner_no_bytes],raffle_program)[0];
            const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
            keys.push(winner_pda_meta)

        }else{
            const winner_pda = await get_participation_account_by_raffle_no_and_winner_no(BigInt(raffle_no),BigInt(winner_no));
            const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
            keys.push(winner_pda_meta)
        }
        
    }


     const ix = new TransactionInstruction({
       programId: raffle_program,
       keys,
       data: Buffer.from([3])
     });
   
     const message = new TransactionMessage({
       instructions: [ix],
       payerKey: authority.publicKey,
       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
     }).compileToV0Message();
   
     const tx = new VersionedTransaction(message);
     tx.sign([authority]);
 
     await connection.sendTransaction(tx);
     
  }

  const claim_prize = async (authority:Keypair,winner:PublicKey, reward_mint:PublicKey, number_of_raffles:bigint) => {
  
    const token_program = await get_token_program_and_decimals(reward_mint)

    const raffle_no_le_byte = numberToLEBytes8(number_of_raffles)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),raffle_no_le_byte],raffle_program)[0]

    
    const winner_ata = getAssociatedTokenAddressSync(
      reward_mint,
      winner,
      false,
      token_program,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const raffle_pda_ata = getAssociatedTokenAddressSync(
      reward_mint,
      raffle_pda,
      true,
      token_program,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const winner_pda = PublicKey.findProgramAddressSync([
      Buffer.from("raf"),
      raffle_no_le_byte,
      Buffer.from("par"),
      winner.toBytes()
    ],raffle_program)[0];


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: false, isWritable: true, pubkey: raffle_pda },
        { isSigner: false, isWritable: true, pubkey: raffle_pda_ata },
        { isSigner: false, isWritable: false, pubkey: winner_pda },
        { isSigner: false, isWritable: false, pubkey: winner },
        { isSigner: false, isWritable: true, pubkey: winner_ata },
        { isSigner: false, isWritable: false, pubkey: reward_mint },
        { isSigner: false, isWritable: false, pubkey: token_program },
        { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
   ],
      data: Buffer.from([100])
    });


    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    const sig = connection.sendTransaction(tx);

    console.log("raffle = " + raffle_pda.toBase58())

    console.log(sig)
  }

  const collect_fee_initializer = async (number_of_raffles:bigint, initializer:Keypair) => {


    const le_bytes = numberToLEBytes8(number_of_raffles)

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
  }

  const collect_fee_token_initializer = async (number_of_raffles:bigint, initializer:Keypair, participation_fee_mint:PublicKey) => {


    const le_bytes = numberToLEBytes8(number_of_raffles)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0]


    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];

    const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];

    const mint_info = await connection.getAccountInfo(participation_fee_mint)

    const token_program = mint_info!.owner

    const fee_collector_ata = getAssociatedTokenAddressSync(participation_fee_mint,fee_collector_account,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
    const raffle_ata = getAssociatedTokenAddressSync(participation_fee_mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
    const initializer_ata = getAssociatedTokenAddressSync(participation_fee_mint,initializer.publicKey,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: initializer.publicKey },
        { isSigner: false, isWritable: false, pubkey: raffle_pda },
        { isSigner: false, isWritable: false, pubkey: term_account },
        { isSigner: false, isWritable: false, pubkey: fee_collector_account },
        { isSigner: false, isWritable: true, pubkey: fee_collector_ata },
        { isSigner: false, isWritable: true, pubkey: initializer_ata },
        { isSigner: false, isWritable: true, pubkey: raffle_ata },
        { isSigner: false, isWritable: false, pubkey: token_program },
        { isSigner: false, isWritable: false, pubkey: participation_fee_mint },
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
  }




