# FIRE EXCLUSIVE — configurazione e verifica

Implementazione locale, **non pubblicata**. Il token FIRE non è ancora disponibile: contratto, soglia, URL Worker e playlist reali sono volutamente vuoti. Nessun saldo fittizio è usato in produzione. Il sito pubblico, il player, Fire Shuffle/Mix, sincronizzazione YouTube e il modulo gratuito restano indipendenti.

## Dove si trova ogni elemento

| Elemento | File |
| --- | --- |
| Seconda CTA, senza modificare il modulo gratuito | `index.html`, `src/styles.css` |
| Pagina inglese e layout responsive | `fire/index.html`, `fire/styles.css` |
| Connessione, sessione, player YouTube | `fire/app.js`, `fire/wallet.js` |
| URL pubblico Worker (nessun secret) | `fire/config.js` |
| Contratto FIRE, soglia, rete, origini, durata sessione | `workers/fire-access/wrangler.jsonc` |
| Controlli firma e saldo | `workers/fire-access/index.js`, `security.js` |
| Tre identificativi cifrati | `workers/fire-access/playlists.encrypted.json` |
| Preparazione locale della cifratura | `scripts/encrypt-fire.mjs` |
| Guida corrente | `docs/FIRE-ACCESS.md` |

## Prova subito la pagina preparatoria

```sh
npm ci
npm run dev
```

Aprire `http://127.0.0.1:4173/creators_of_fire/fire/` (funziona anche `/fire/`). Il pulsante wallet è disabilitato finché la configurazione non è pronta. Nessuna richiesta a Cloudflare, NEAR, Meteor o YouTube parte dall'area FIRE non configurata. I link verso homepage e richiesta gratuita sono relativi e funzionano anche sotto `/creators_of_fire/`.

Per controllare esattamente il sito compilato:

```sh
npm run build
node scripts/serve.mjs --dist
```

La homepage conserva il suo JavaScript senza framework. Il bundle Wallet Selector/Meteor viene scaricato solo nell'area FIRE configurata, dopo il clic su Connect. È separato dal player pubblico. `npm ci` è stato aggiunto al workflow Pages perché ora esistono dipendenze di build fissate nel lockfile.

## 1. Preparare le tre playlist

Creare tre playlist YouTube distinte, **Non in elenco**, e rendere incorporabili anche tutti i video. Nicholas continuerà ad aggiungere/togliere video da YouTube: gli embed delle playlist mostreranno gli aggiornamenti senza sincronizzazioni o modifiche al codice. Possono esserci ritardi di cache di YouTube.

Creare localmente la cartella `.fire-private/` e il file `playlists.json` al suo interno:

```json
{
  "exclusive": "",
  "alternate": "",
  "early": ""
}
```

Inserire nelle tre stringhe vuote i veri valori del parametro `list` degli URL YouTube. Non inserire URL interi. I campi vuoti non sono valori validi: lo script si rifiuta di cifrarli. Non incollare gli ID in issue, commit, screenshot pubblici o altri file del progetto.

```sh
npm run fire:encrypt
```

Lo script genera due secret casuali a 256 bit, solo se non esistono già:

- `.fire-private/playlist-key` — chiave AES-256-GCM permanente;
- `.fire-private/challenge-secret` — firma HMAC delle richieste di autenticazione.

Il file da conservare in Git è **solo** `workers/fire-access/playlists.encrypted.json`. La cartella privata è esclusa da Git e dalla build; permessi locali della cartella 700, dei secret 600. Non viene stampato alcun ID o secret. Dopo il caricamento nel Worker, rimuovere i file in chiaro o conservarli in un gestore sicuro fuori dal progetto. Non perdere la chiave prima di aver caricato il secret. Per sostituire una playlist, ricifrare con la stessa chiave; per aggiungere brani a una playlist esistente non occorre farlo.

## 2. Configurare contratto e soglia futuri

In `workers/fire-access/wrangler.jsonc`, sezione `vars`:

- `NETWORK`: `mainnet` per la pubblicazione, `testnet` soltanto per un ambiente di prova separato;
- `FIRE_CONTRACT`: vero account NEAR del contratto fungible token NEP-141;
- `MINIMUM_FIRE`: soglia in token, come stringa decimale positiva (nessuna soglia è stata decisa al posto del proprietario);
- `SESSION_SECONDS`: 1800 di default, configurabile tra 60 e 3600;
- `ALLOWED_ORIGINS`: origini esatte separate da virgola, senza slash finale. Lasciare solo quelle effettivamente usate. Per le prove locali aggiungere temporaneamente `http://127.0.0.1:4173`, mai `*`.

Il Worker legge i decimali da `ft_metadata`, non assume 18 o 24 decimali. Confronta quantità intere con `BigInt`, senza arrotondamenti. Il contratto deve implementare `ft_balance_of` e `ft_metadata` secondo gli standard NEAR. Il simbolo mostrato è FIRE; l'identità effettiva del token dipende **dal contratto configurato**, non dal simbolo.

## 3. Cloudflare Workers Free (dopo l'approvazione)

Non è necessario spostare i DNS da Spaceship né spostare GitHub Pages. Creare un account Cloudflare con piano Workers Free e un sottodominio gratuito `workers.dev`. Nessun binding KV, D1, R2, Durable Objects, database o storage musicale è richiesto. Non attivare Workers Paid.

**I comandi di pubblicazione qui sotto sono istruzioni future, non sono stati eseguiti. Eseguirli soltanto dopo la conferma del proprietario e con la configurazione completa.**

```sh
npx wrangler login
npx wrangler secret put PLAYLIST_KEY --config workers/fire-access/wrangler.jsonc < .fire-private/playlist-key
npx wrangler secret put CHALLENGE_SECRET --config workers/fire-access/wrangler.jsonc < .fire-private/challenge-secret
npx wrangler deploy --config workers/fire-access/wrangler.jsonc
```

Se il Worker ancora non esiste, Wrangler può chiedere di crearlo durante il caricamento dei secret. Anche questo è un passaggio da fare dopo l'approvazione. Non inserire i secret in `vars`, in GitHub Pages, nel frontend o nella cronologia dei comandi. Il progetto usa solo `workers.dev`, senza route sul dominio e senza modifiche a Spaceship.

Prendere l'URL HTTPS effettivo stampato da Cloudflare e inserirlo in `fire/config.js`, senza percorso o slash finale. Questo URL è pubblico e non è una credenziale. Dopo il test, pubblicare il frontend solo con l'approvazione del proprietario: il push su `main` avvia già GitHub Pages.

Il piano Free ha limiti (attualmente 100.000 richieste/giorno, 10 ms CPU per invocazione; l'attesa del servizio RPC non è CPU). Il Worker usa Web Crypto nativo ed è piccolo. Il test locale non dimostra il consumo CPU in produzione: verificarlo su Cloudflare prima del lancio. Se quota/CPU/RPC vengono superati, l'accesso fallisce chiuso; non c'è passaggio automatico a un servizio a pagamento. Non c'è un contatore antispam persistente: un servizio pubblico può subire abuso della quota. CORS limita i browser, non sostituisce l'autenticazione né un rate limiter. Valutare le metriche del piano gratuito prima di aprirlo al pubblico.

## Come funziona la verifica

1. Il browser richiede un messaggio con nonce casuale, origine, rete, contratto, scadenza di 2 minuti e identificativo casuale della scheda. Il Worker lo autentica con HMAC.
2. NEAR Wallet Selector carica il modulo ufficiale Meteor. Viene chiamato **solo `signMessage` (NEP-413)**: niente `signIn`, creazione di access key, metodi di transazione o token transfer. Meteor permette di scegliere l'account nel flusso di firma. Il sito non riceve private key o recovery phrase.
3. Il Worker verifica Ed25519 sul digest SHA-256 della struttura Borsh NEP-413, poi verifica che quella precisa chiave sia una FullAccess key dell'account dichiarato tramite RPC. Una firma valida con chiave estranea non basta.
4. Legge metadati e saldo dello stesso blocco finale della verifica account. Saldo insufficiente restituisce soltanto saldo e soglia; firma/servizi non validi non sbloccano nulla.
5. Decifra il bundle AES nel Worker, poi **ricifra gli ID con una nuova chiave AES casuale per la sessione**. Il browser riceve questo nuovo pacchetto cifrato e la chiave temporanea via HTTPS, e lo decifra. La chiave permanente `PLAYLIST_KEY` non viene mai trasmessa al browser.
6. I tre embed YouTube vengono creati soltanto dopo il controllo. Nessuna richiesta periodica durante l'ascolto; alla scadenza gli embed vengono rimossi, anche al ritorno da una scheda sospesa. Disconnect, cambio account/rete e uscita dalla pagina richiudono l'area. Un rinnovo richiede una nuova firma e un nuovo saldo.

Chiavi temporanee e accesso non vengono salvati in localStorage/sessionStorage. Il modulo wallet può mantenere proprie preferenze locali. La disconnessione del sito chiude l'accesso locale, non revoca account o chiavi nel wallet.

**Limiti reali:** senza database, un messaggio già firmato può essere riutilizzato nei suoi 2 minuti di validità; ogni riutilizzo controlla nuovamente il saldo. Non si dichiara una protezione one-time assoluta. Il controllo dei token è una fotografia: se un utente trasferisce i token subito dopo lo sblocco, la sessione aperta può durare fino alla scadenza. Per ridurre la finestra si può ridurre `SESSION_SECONDS`.

**YouTube Non in elenco non è DRM:** un utente autorizzato può vedere/copiare gli ID dagli embed e condividere i link. La scadenza rimuove i player dal sito, ma non revoca un link YouTube già ottenuto, né rende inutilizzabile un pacchetto salvato da un client modificato. La cifratura protegge il repository e l'accesso iniziale, non impedisce la redistribuzione da parte di un ascoltatore autorizzato. Per revocare un link occorre intervenire su YouTube. Nessun audio viene scaricato, convertito, proxato o salvato.

## 4. Test prima della pubblicazione

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
npm run fire:worker:check
npx playwright install chromium
npm run test:browser
```

`fire:worker:check` usa **solo `--dry-run`**: compila senza pubblicare. I test di sicurezza usano chiavi Ed25519 realmente generate, cifratura autentica e risposte RPC sintetiche isolate nei test. Queste fixture non sono importate dalla pagina o dal Worker di produzione. I test browser usano risposte intercettate esclusivamente nell'ambiente di test per verificare popup, successo, errore, scadenza, concorrenza e mobile.

Per un test integrato locale con un token **realmente esistente su testnet**, configurare una copia locale di Wrangler, rete testnet e il vero contratto di prova. Mettere i due secret in `workers/fire-access/.dev.vars` (escluso da Git) usando i nomi `PLAYLIST_KEY` e `CHALLENGE_SECRET`; non incollarli in output pubblici. Avviare `npm run fire:worker:dev`, aggiungere l'origine localhost consentita e impostare temporaneamente il suo URL locale in `fire/config.js`. Il Worker usa le query RPC reali anche in sviluppo. Prima della pubblicazione rimuovere le configurazioni locali/testnet.

Con Meteor verificare manualmente, su computer e telefono:

- scegli account, firma il messaggio, annulla firma, popup bloccato, popup abbandonato;
- account con saldo inferiore/superiore alla soglia, chiave revocata e rete errata;
- accesso con account diverso, Disconnect, scadenza e ritorno dopo sospensione;
- riproduzione delle tre playlist reali, nuovi video aggiunti da YouTube;
- nessuna richiesta di transazione, pagamento, seed phrase o access key;
- console senza errori e risposta Worker senza chiave permanente;
- pagina `/fire/` e `/creators_of_fire/fire/`, homepage e modulo gratuito invariati.

**Non si può dichiarare completato il test end-to-end reale oggi:** mancano contratto FIRE, playlist reali, Worker pubblicato e approvazione con un wallet del proprietario. La modalità preparatoria e i flussi simulati sono verificabili ora. Il lancio resta subordinato a questa prova.

## Dipendenze e fonti

Wallet Selector/Meteor sono fissati a 10.1.4. Due override risolvono avvisi nelle dipendenze indirette (`nanoid` e `decode-uri-component`); la build adatta il decoder ESM al chiamante CommonJS. Gli avvisi residui di npm sono di livello basso, nella catena `elliptic`/secp256k1 dei pacchetti upstream. Il Worker non usa queste librerie: verifica solo Ed25519 con Web Crypto. Ricontrollare gli aggiornamenti prima del lancio; non applicare `npm audit fix --force` indiscriminatamente.

- [NEP-413: standard della firma messaggi](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [NEAR Wallet Selector e modulo Meteor](https://github.com/near/wallet-selector)
- [NEAR RPC: chiavi account e chiamate read-only](https://docs.near.org/api/rpc/contracts)
- [Cloudflare: secret](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare: prezzi e piano Free](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare: limiti](https://developers.cloudflare.com/workers/platform/limits/)
