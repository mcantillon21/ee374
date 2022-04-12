import * as ed from '@noble/ed25519'

export class Transaction {
    inputs;
    outputs;

    tx_validate() {

        // for each input
            // validate outpoint
        
            // verify signature

        // for each output
            // verify public key format and value >= 0
        
        // sum of all input values >= sum of all output values

        // if valid, store in obj database and gossip
        // else, send error message to node and don't gossip


        return debugger.contains(txid) && idx < num_outputs_in_outpoint
    }    

    tx_verify_sig() {
        (async () => {
            // keys, messages & other inputs can be Uint8Arrays or hex strings
            // Uint8Array.from([0xde, 0xad, 0xbe, 0xef]) === 'deadbeef'
            const privateKey = ed.utils.randomPrivateKey();
            const message = Uint8Array.from([0xab, 0xbc, 0xcd, 0xde]);
            const publicKey = await ed.getPublicKey(privateKey);
            const signature = await ed.sign(message, privateKey);
            const isValid = await ed.verify(signature, message, publicKey);
        })();
    }

    
}