import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finante", "0012_userprofile_budget_cycle_start_day"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FinancialArchive",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("cycle_key", models.CharField(max_length=7)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("building", "În curs"),
                            ("ready", "Pregătită"),
                            ("failed", "Eșuată"),
                        ],
                        default="building",
                        max_length=12,
                    ),
                ),
                ("relative_dir", models.CharField(blank=True, default="", max_length=300)),
                ("source_digest", models.CharField(blank=True, default="", max_length=64)),
                ("manifest_sha256", models.CharField(blank=True, default="", max_length=64)),
                ("record_counts", models.JSONField(blank=True, default=dict)),
                ("totals", models.JSONField(blank=True, default=dict)),
                ("files", models.JSONField(blank=True, default=dict)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="financial_archives",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-period_end", "-created_at"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("user", "period_start", "period_end"),
                        name="unique_financial_archive_period_per_user",
                    )
                ],
            },
        ),
    ]
