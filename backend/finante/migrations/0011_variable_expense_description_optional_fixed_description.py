# Generated manually on 2026-07-23

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finante", "0010_alter_miscarefond_data_alter_miscarefond_rubrica_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cheltuialafixa",
            name="descriere",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="cheltuialavariabila",
            name="descriere",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
