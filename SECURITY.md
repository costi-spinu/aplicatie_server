# Securizare pentru acces din Tailscale (Raspberry Pi)

Dacă aplicația este accesată doar prin Tailscale, traficul **în interiorul Tailnet** este deja criptat.
Totuși, browserul arată "Not secure" când deschizi `http://IP:port` pentru că lipsește HTTPS la nivel HTTP.

## Recomandări rapide

1. **Nu expune porturile în internet** (router/NAT)
   - Fără port-forwarding către Pi.
   - Firewall: permite acces doar pe interfața Tailscale (`tailscale0`) la porturile aplicației.

2. **Folosește hostname + TLS pe Tailnet**
   - Evită accesul pe `http://192.168.x.x:8080`.
   - Folosește nume DNS Tailscale (MagicDNS), ex: `pi-buget.tailnet-name.ts.net`.

3. **Activează HTTPS cu reverse-proxy**
   - Variante simple:
     - `tailscale serve` (rapid pentru home-lab)
     - Caddy/Nginx cu certificat Tailscale (`tailscale cert`)

4. **Setează aplicația în mod production**
   - `DJANGO_DEBUG=False`
   - `DJANGO_ALLOWED_HOSTS=<hostname-ts.net>,<ip-tailscale>`
   - `DJANGO_CSRF_TRUSTED_ORIGINS=https://<hostname-ts.net>`
   - `DJANGO_CORS_ALLOW_ALL_ORIGINS=False`
   - `DJANGO_CORS_ALLOWED_ORIGINS=https://<hostname-ts.net>`
   - Dacă reverse proxy trimite HTTPS:
     - `DJANGO_SECURE_SSL_REDIRECT=True`
     - `DJANGO_SECURE_COOKIES=True`

5. **Autentificare și token-uri**
   - Nu păstra credențiale implicite în cod.
   - Folosește parole puternice și rotire periodică.
   - Opțional, mută token-ul din `localStorage` în cookie `HttpOnly` dacă vrei protecție mai bună la XSS.

## Ce s-a schimbat în cod

- Backend-ul Django folosește setări de securitate din variabile de mediu:
  - DEBUG/ALLOWED_HOSTS/CSRF/CORS configurabile.
  - antete securitate (`X-Frame-Options`, `nosniff`, `Referrer-Policy`).
  - opțiuni pentru redirect HTTPS, HSTS, cookie-uri secure.
- Frontend-ul nu mai are URL hardcodat `127.0.0.1`, ci folosește:
  - `VITE_API_BASE_URL` (dacă este setat)
  - altfel fallback la `window.location.origin`.

## Exemplu `.env` (backend)

```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=pi-buget.tailnet-name.ts.net,100.x.y.z
DJANGO_CSRF_TRUSTED_ORIGINS=https://pi-buget.tailnet-name.ts.net
DJANGO_CORS_ALLOW_ALL_ORIGINS=False
DJANGO_CORS_ALLOWED_ORIGINS=https://pi-buget.tailnet-name.ts.net
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_COOKIES=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False
```

## Observație importantă

Dacă folosești doar IP local (`192.168.x.x`) în browser, vei vedea în continuare avertisment de securitate pentru HTTP. Pentru "lock" verde ai nevoie de **HTTPS cu certificat valid pentru hostname**.
