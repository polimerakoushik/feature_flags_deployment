from __future__ import annotations

import os

from django.conf import settings
from django.http import JsonResponse
from django.urls import path

from backend.utils.flag_middleware import FlagCacheClient

if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY="demo-secret-key",
        INSTALLED_APPS=[],
        ROOT_URLCONF=__name__,
        MIDDLEWARE=[],
    )

api_base_url = os.getenv("FEATURE_FLAG_API_URL", "http://localhost:8002/api")
cache = FlagCacheClient(
    api_base_url=api_base_url,
    refresh_interval=30,
    auth_token=os.getenv("FEATURE_FLAG_API_TOKEN"),
)
cache.start(background=True)


def checkout(request):
    user_id = request.GET.get("user_id") or "anonymous"
    groups = request.GET.getlist("group")
    allowed = cache.evaluate(
        "new-checkout",
        user_id=user_id,
        groups=groups or None,
        environment="production",
    )
    return JsonResponse(
        {
            "enabled": allowed,
            "user_id": user_id,
            "groups": groups,
            "source": "django middleware cache",
        }
    )


urlpatterns = [
    path("checkout", checkout),
]


if __name__ == "__main__":
    import django

    django.setup()
    from django.core.management import execute_from_command_line

    execute_from_command_line(["manage.py", "runserver", "0.0.0.0:9002"])
