// 0) MUSÍ byť hore – polyfill WebSocket pre Node
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;



import { Builder,getAssetDecimals,getAllAssetsSymbols,CHAINS } from '@paraspell/sdk';



import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getPolkadotSigner } from 'polkadot-api/signer';
import 'dotenv/config';
import prompts from 'prompts';

const WS    = process.env.WS_URL!;        // napr. wss://asset-hub-paseo-rpc.polkadot.io
const FROM = process.env.PASEO_ADDRESS!;     // odosielateľ
const TO    = process.env.PASEO_ADDRESS_2!;     // príjemca
const MNEMO = process.env.PASEO_MNEMONIC!;    // 12/24 slov







async function main() {

    await cryptoWaitReady(); // inicializácia WASM crypto (sr25519)

    // 1) odosielateľ (sr25519) + PAPI PolkadotSigner
    const pair = new Keyring({ type: 'sr25519' }).addFromUri(MNEMO);
    const signer = getPolkadotSigner(pair.publicKey, 'Sr25519', (payload) => pair.sign(payload));

    console.log(CHAINS);
    console.log('Dostupné meny na AssetHubPaseo:', await getAllAssetsSymbols('AssetHubPaseo'));
    


    

    const response = await prompts([
        {
            type: 'text',
            name: 'from',
            message: 'Adresa odosielateľa:',
            initial: FROM,
        },
        {
            type: 'text',
            name: 'to',
            message: 'Adresa prijímateľa:',
            initial: TO,
        },
        {
            type: 'text',
            name: 'currency',
            message: 'Mena (symbol):',
            initial: 'PAS',
        },
        {
            type: 'text',
            name: 'amount',
            message: 'Koľko chces poslať:',
            initial: '0.0001',
            validate: value => !isNaN(parseFloat(value)) && parseFloat(value) >= 0
            ? true
            : 'Zadajte platné číslo >= 0',
        },
    ], {
        onCancel: () => {
            console.log('Zrušené používateľom.');
            process.exit(1);
        }
    });
    

    
    const { from, to, currency, amount } = response;
    //convert na cislo
    const numericAmount = parseFloat(amount);
    


    const decimals = (await getAssetDecimals('AssetHubPaseo', currency ))?? 0;
    console.log(`Mena ${currency} má ${decimals} desatinných miest.`);
    
    

// 🌟 prepočítaj množstvo na base units (BigInt, aby sa nestratila presnosť)
const baseAmount = BigInt(Math.round(numericAmount * 10 ** decimals));



    console.log('\n--- Nastavenia transakcie ---');
    console.log('Odosielateľ:', from);
    console.log('Príjemca:', to);
    console.log('SCurrency:', currency);
    console.log('Suma:', amount );
    console.log('Suma (base units):', baseAmount.toString() );
    console.log('-----------------------------\n');

    //
    



    // 2) builder – POZOR: senderAddress = adresa odosielateľa!
    const builder = Builder(WS)
        .from('AssetHubPaseo')
        .to('AssetHubPaseo')
        .currency({ symbol: currency, amount: baseAmount })
        .address(TO)
        .senderAddress(FROM);

    // voliteľne náhľad

    // 3) build → sign&submit (PAPI štýl)
    const tx = await builder.build();

    // PRIMÁRNE: signAndSubmit s PolkadotSignerom
    const finalized = await (tx as any).signAndSubmit(signer);
    console.log('Transakcia finalizovaná. TX hash:', finalized.txHash);
    console.log('Blok číslo:', finalized.block.number);
    console.log('Blok hash:', finalized.block.hash);
    console.log('-----------------------------\n');
    // UKONČIŤ

    await (builder as any).disconnect?.();
    await (builder as any).destroy?.();
    process.exit(0);

    // finalized.txHash, finalized.block.number atď. podľa PAPI rozhrania
}


main().catch(console.error);
