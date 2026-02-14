from django.db.models import Q
from .models import UserBridge


def get_connected_user_ids(user):
    """
    Returnează lista de user_ids:
    - userul curent
    - utilizatorii conectați prin bridge acceptat
    """

    bridges = UserBridge.objects.filter(accepted=True).filter(
        Q(from_user=user) | Q(to_user=user)
    )

    connected_user_ids = []

    for bridge in bridges:
        if bridge.from_user_id == user.id:
            connected_user_ids.append(bridge.to_user_id)
        else:
            connected_user_ids.append(bridge.from_user_id)

    return [user.id] + connected_user_ids


