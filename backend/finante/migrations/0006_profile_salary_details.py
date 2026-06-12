from django.db import migrations, models
import django.utils.timezone
from datetime import date
from calendar import monthrange


def seed_salary_dates(apps, schema_editor):
    SalarySchedule = apps.get_model("finante", "SalarySchedule")
    today = django.utils.timezone.localdate()
    last_day = monthrange(today.year, today.month)[1]
    for schedule in SalarySchedule.objects.all():
        target_day = min(schedule.zi or today.day, last_day)
        schedule.data = date(today.year, today.month, target_day)
        schedule.save(update_fields=["data"])


class Migration(migrations.Migration):
    dependencies = [
        ("finante", "0005_obiectiv_cheltuieli_global"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="telefon",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="salaryschedule",
            name="data",
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
        migrations.AddField(
            model_name="salaryschedule",
            name="ocupatie",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RunPython(seed_salary_dates, migrations.RunPython.noop),
    ]
