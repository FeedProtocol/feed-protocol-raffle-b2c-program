import {
    Keypair,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    AccountMeta,
    ComputeBudgetProgram,
  } from "@solana/web3.js";
  import * as borsh from 'borsh';
  import {  Raffle, RaffleSchema,  } from "./models";
  import {connection} from './connection';
  import { raffle_program, } from "./accounts";
  import {  numberToLEBytes8 } from "./utils";
  import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,  } from "@solana/spl-token";
  import {  get_participation_fee_mint,  get_token_program_and_decimals } from "./get_info";

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



  export const join_raffle = async (raffle_no:bigint, participant:Keypair) => {

    const raffle_no_le_byte = numberToLEBytes8(raffle_no)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),raffle_no_le_byte],raffle_program)[0]

    const raffle_account_info = await connection.getAccountInfo(raffle_pda);

    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    let participant_pda:PublicKey;
    if(raffle.multiple_participation_allowed != 1){

       participant_pda = PublicKey.findProgramAddressSync([
        Buffer.from("raf"),
        raffle_no_le_byte,
        Buffer.from("par"),
        participant.publicKey.toBytes()
      ],raffle_program)[0];

    }else{

      const participant_no:bigint = BigInt(Number(raffle.current_number_of_participants)+1)
      const participant_no_bytes = numberToLEBytes8(participant_no)

      participant_pda = PublicKey.findProgramAddressSync([
        Buffer.from("raf"),
        raffle_no_le_byte,
        Buffer.from("par"),
        participant_no_bytes
      ],raffle_program)[0];

    }



    console.log(participant.publicKey.toBase58())

    const keys:AccountMeta[] = [];

         
    const participant_meta = { isSigner: true, isWritable: true, pubkey: participant.publicKey }
    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda }
    const participant_pda_meta = { isSigner: false, isWritable: true, pubkey: participant_pda }

    keys.push(participant_meta)
    keys.push(raffle_pda_meta)
    keys.push(participant_pda_meta)


    if (raffle.participation_fee_type == BigInt(1)){
      console.log("solana fee")
        const participation_fee_mint_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }

        keys.push(participation_fee_mint_meta)

    }else{
        const participation_fee_mint = await get_participation_fee_mint(raffle.participation_fee_type)
        const participation_fee_mint_meta = { isSigner: false, isWritable: false, pubkey: participation_fee_mint }
        keys.push(participation_fee_mint_meta)

        const [token_program,decimals] = await get_token_program_and_decimals(participation_fee_mint)
        const participant_ata = getAssociatedTokenAddressSync(participation_fee_mint,participant.publicKey,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
        const raffle_ata = getAssociatedTokenAddressSync(participation_fee_mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

        const participant_ata_meta = { isSigner: false, isWritable: true, pubkey: participant_ata }
        const raffle_ata_meta = { isSigner: false, isWritable: true, pubkey: raffle_ata }
        const token_program_meta = { isSigner: false, isWritable: false, pubkey: token_program }

        keys.push(participant_ata_meta)
        keys.push(raffle_ata_meta)
        keys.push(token_program_meta)

    }



    if (raffle.requirement_to_participate == 1){
      const requirement_mint = new PublicKey(raffle.requirement_mint);
      const req_mint_account_info = await connection.getAccountInfo(requirement_mint)
      const required_mint_token_program = req_mint_account_info?.owner!;
      const participant_requirement_ata = getAssociatedTokenAddressSync(requirement_mint,participant.publicKey,false,required_mint_token_program,ASSOCIATED_TOKEN_PROGRAM_ID);
      const raffle_requirement_ata = getAssociatedTokenAddressSync(requirement_mint,raffle_pda,true,required_mint_token_program,ASSOCIATED_TOKEN_PROGRAM_ID);


      const requirement_mint_meta = {isSigner: false, isWritable: false, pubkey: requirement_mint }
      const participant_requirement_ata_meta = {isSigner: false, isWritable: true, pubkey: participant_requirement_ata }
      const raffle_requirement_ata_meta = {isSigner: false, isWritable: true, pubkey: raffle_requirement_ata }
      const required_mint_token_program_meta = {isSigner: false, isWritable: true, pubkey: required_mint_token_program }

      keys.push(requirement_mint_meta)
      keys.push(participant_requirement_ata_meta)
      keys.push(raffle_requirement_ata_meta)
      keys.push(required_mint_token_program_meta)
    }

    const system_program_program_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }
    keys.push(system_program_program_meta)
    
    const computeBudgetIx1 = ComputeBudgetProgram.setComputeUnitLimit({units:300000});


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys,
      data: Buffer.from([1])
    });

    const message = new TransactionMessage({
      instructions: [computeBudgetIx1,ix],
      payerKey: participant.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([participant]);

    const sig = await connection.sendTransaction(tx);


    return delay(600)

}

  export const claim_prize = async (participant:Keypair,  raffle_no:bigint, winner_no:bigint) => {
  

    const raffle_no_le_byte = numberToLEBytes8(raffle_no)

    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),raffle_no_le_byte],raffle_program)[0]

    const raffle_account_info = await connection.getAccountInfo(raffle_pda);

    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    const reward_mint:PublicKey = new PublicKey(raffle.reward_mint);
    
    //const [token_program,decimals] = await get_token_program_and_decimals(reward_mint)
    
    const winner_ata = getAssociatedTokenAddressSync(
      reward_mint,
      participant.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const raffle_pda_ata = getAssociatedTokenAddressSync(
      reward_mint,
      raffle_pda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let winner_pda:PublicKey;

    if (raffle.multiple_participation_allowed != 1){

      winner_pda = PublicKey.findProgramAddressSync([
        Buffer.from("raf"),
        raffle_no_le_byte,
        Buffer.from("par"),
        participant.publicKey.toBytes()
      ],raffle_program)[0];

    }else{
      const participant_no_bytes = numberToLEBytes8(winner_no)

      winner_pda = PublicKey.findProgramAddressSync([
        Buffer.from("raf"),
        raffle_no_le_byte,
        Buffer.from("par"),
        participant_no_bytes
      ],raffle_program)[0];
    }

    console.log(winner_pda.toBase58())


    const keys:AccountMeta[] = [];

    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda };
    const raffle_pda_ata_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda_ata };
    const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda! };
    const participant_meta = { isSigner: false, isWritable: false, pubkey: participant.publicKey };
    const winner_ata_meta = { isSigner: false, isWritable: true, pubkey: winner_ata };
    const reward_mint_meta = { isSigner: false, isWritable: false, pubkey: reward_mint };
    const token_program_meta = { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID };
    const SYSVAR_RENT_PUBKEY_meta = { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY };
    const SystemProgram_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId };
    const ASSOCIATED_TOKEN_PROGRAM_ID_meta = { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID };

    keys.push(raffle_pda_meta)
    keys.push(raffle_pda_ata_meta)
    keys.push(winner_pda_meta)
    keys.push(participant_meta)
    keys.push(winner_ata_meta)
    keys.push(reward_mint_meta)
    keys.push(token_program_meta)
    keys.push(SYSVAR_RENT_PUBKEY_meta)


    if (raffle.requirement_to_participate == 1){
    
      const req_mint = new PublicKey(raffle.requirement_mint);
      const req_mint_info = await connection.getAccountInfo(req_mint);
      const req_mint_token_program = req_mint_info?.owner!

      const raffle_req_ata = getAssociatedTokenAddressSync(req_mint,raffle_pda,true,req_mint_token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
      const participant_req_ata = getAssociatedTokenAddressSync(req_mint,participant.publicKey,false,req_mint_token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

      const raffle_req_ata_meta:AccountMeta = {isSigner: false, isWritable: true, pubkey: raffle_req_ata}
      const participant_req_ata_meta:AccountMeta = {isSigner: false, isWritable: true, pubkey: participant_req_ata}
      const req_mint_meta:AccountMeta = {isSigner: false, isWritable: false, pubkey: req_mint}
      const req_mint_token_program_meta:AccountMeta = {isSigner: false, isWritable: false, pubkey: req_mint_token_program}

      keys.push(raffle_req_ata_meta)
      keys.push(participant_req_ata_meta)
      keys.push(req_mint_meta)
      keys.push(req_mint_token_program_meta)

    }
    keys.push(SystemProgram_meta)
    keys.push(ASSOCIATED_TOKEN_PROGRAM_ID_meta)

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys,
      data: Buffer.from([100])
    });


    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: participant.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([participant]);

    const sig = connection.sendTransaction(tx);

    console.log("raffle = " + raffle_pda.toBase58())

    console.log(sig)
return delay(600)
}

