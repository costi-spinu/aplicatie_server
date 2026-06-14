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
    seen_user_ids = {user.id}

    for bridge in bridges:
        if bridge.from_user_id == user.id:
            connected_user_id = bridge.to_user_id
        else:
            connected_user_id = bridge.from_user_id

        if connected_user_id not in seen_user_ids:
            seen_user_ids.add(connected_user_id)
            connected_user_ids.append(connected_user_id)

    return [user.id] + connected_user_ids

