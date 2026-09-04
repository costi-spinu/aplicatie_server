# Arhivarea datelor financiare

Procesul arhivează numai `Venit`, `Credit`, `CheltuialaFixa` și
`CheltuialaVariabila`. Ciclul curent și ciclul anterior rămân integral în
PostgreSQL. Automatizările, obiectivele, economiile lunare și mișcările de
fond nu sunt șterse, deoarece sunt necesare calculelor curente.

Fișierele private sunt create implicit în
`arhiva/date-financiare/user-<id>/...`. Directorul nu trebuie expus prin nginx;
descărcarea PDF/Excel se face exclusiv prin API-ul autentificat.

Verificare fără modificarea datelor:

```bash
venv/bin/python backend/manage.py archive_financial_records --dry-run
```

Rulare manuală:

```bash
venv/bin/python backend/manage.py archive_financial_records
```

Pentru automatizare, copiază fișierele `deploy/aplicatie-archive.service` și
`deploy/aplicatie-archive.timer` în `/etc/systemd/system/`, apoi rulează
`systemctl daemon-reload` și `systemctl enable --now aplicatie-archive.timer`.
Variabilele PostgreSQL pot fi păstrate în `/etc/default/aplicatie`.

Folderul local de arhivă trebuie inclus separat în backup. El nu este un backup
de unul singur dacă discul serverului se defectează.
