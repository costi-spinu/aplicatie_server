# Instalare pe iPhone si Android

Aplicatia este configurata ca PWA. Asta inseamna ca baza de date ramane pe
Raspberry Pi, iar telefonul instaleaza doar interfata web in mod standalone,
fara bara obisnuita a browserului.

## Pregatire pe Raspberry Pi

Ruleaza:

```bash
./scripts/mobile-install.sh
```

Scriptul detecteaza automat un IP local, construieste frontend-ul cu manifestul
PWA si ruleaza `collectstatic` pentru Django.

Pentru o adresa fixa sau HTTPS:

```bash
APP_ORIGIN=https://numele-tau.tailnet.ts.net API_ORIGIN=https://numele-tau.tailnet.ts.net ./scripts/mobile-install.sh
```

Pentru acces atat din reteaua de acasa, cat si prin Tailscale:

```bash
APP_HOST=192.168.1.20 TAILSCALE_HOST=100.75.19.22 ./scripts/mobile-install.sh
```

Pentru Tailscale HTTPS / MagicDNS:

```bash
APP_HOST=192.168.1.20 TAILSCALE_ORIGIN=https://raspberry.tailnet.ts.net ./scripts/mobile-install.sh
```

Scriptul pune ambele adrese in aplicatie:

```bash
VITE_INSTALL_URLS=http://192.168.1.20:5173/,https://raspberry.tailnet.ts.net/
VITE_API_BASE_URL=https://raspberry.tailnet.ts.net/api/,http://192.168.1.20:8000/api/
```

Va genera si QR-uri separate:

```text
frontend/dist/install-qr-local.svg
frontend/dist/install-qr-tailscale.svg
```

Daca frontend-ul si backend-ul ruleaza pe porturi separate:

```bash
FRONTEND_PORT=5173 BACKEND_PORT=8000 ./scripts/mobile-install.sh
```

Daca QR-ul sau campul `Adresa aplicatie` arata `127.0.0.1` ori `localhost`,
telefonul nu va putea ajunge la Raspberry Pi. Ruleaza scriptul cu IP-ul real:

```bash
APP_HOST=192.168.1.20 ./scripts/mobile-install.sh
```

Inlocuieste `192.168.1.20` cu IP-ul Raspberry Pi din reteaua ta.

## iPhone

1. Deschide linkul afisat de script in Safari.
2. Apasa butonul de Partajare.
3. Alege `Adaugare pe ecranul principal`.
4. Deschide aplicatia din iconita noua.

## Android

1. Deschide linkul afisat de script in Chrome.
2. Apasa `Instaleaza aplicatia` daca apare.
3. Daca nu apare, deschide meniul Chrome si alege `Adauga pe ecranul principal`.
4. Deschide aplicatia din iconita noua.

## Login si Face ID

Aplicatia pastreaza refresh tokenul timp de 30 de zile implicit, deci ramane
logata ca o aplicatie normala. Poti schimba perioada din backend:

```bash
JWT_REFRESH_TOKEN_DAYS=90
```

iPhone si Android pot folosi Face ID, Touch ID sau amprenta prin managerul de
parole al telefonului pentru completarea parolei. Pentru passkeys/WebAuthn
reale este nevoie ca aplicatia sa fie deschisa pe HTTPS, nu pe HTTP simplu din
reteaua locala.
