from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from finante.archive_service import archive_old_financial_data


class Command(BaseCommand):
    help = (
        "Arhivează veniturile, creditele și cheltuielile vechi pe discul local; "
        "păstrează în DB ciclul curent și ciclul anterior."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--as-of",
            dest="as_of",
            help="Data de referință YYYY-MM-DD (implicit: astăzi).",
        )
        parser.add_argument(
            "--user",
            dest="username",
            help="Arhivează doar acest username.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Afișează ce ar fi arhivat, fără fișiere sau ștergeri.",
        )

    def handle(self, *args, **options):
        as_of = None
        if options.get("as_of"):
            try:
                as_of = date.fromisoformat(options["as_of"])
            except ValueError as exc:
                raise CommandError("--as-of trebuie să aibă formatul YYYY-MM-DD.") from exc

        users = get_user_model().objects.all().order_by("id")
        if options.get("username"):
            users = users.filter(username__iexact=options["username"])
            if not users.exists():
                raise CommandError("Utilizatorul solicitat nu există.")

        total_archives = 0
        for user in users:
            result = archive_old_financial_data(
                user,
                as_of=as_of,
                dry_run=options["dry_run"],
            )
            count = len(result["archives"])
            total_archives += count
            self.stdout.write(
                f"{user.username}: cutoff {result['cutoff']}, {count} cicluri."
            )
            for archive in result["archives"]:
                self.stdout.write(
                    f"  {archive['period_start']} - {archive['period_end']}: "
                    f"{archive['status']} {archive['record_counts']}"
                )

        action = "identificate" if options["dry_run"] else "arhivate"
        self.stdout.write(self.style.SUCCESS(f"{total_archives} cicluri {action}."))
