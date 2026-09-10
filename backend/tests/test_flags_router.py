from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.models.user_group import UserGroup
from backend.models.user_group_membership import UserGroupMembership
from backend.models.environment import Environment
from routers.evaluation import router as evaluation_router
from routers.flags import router as flags_router
from backend.services.auth import get_current_user as auth_get_current_user
from backend.utils.deps import get_current_user


class FakeUser:
    id = 1
    email = "qa@featureflow.local"


def test_create_flag_persists_and_returns_record():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(flags_router)
    app.include_router(evaluation_router)

    def override_get_db():
        database = testing_session()
        try:
            yield database
        finally:
            database.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: FakeUser()
    app.dependency_overrides[auth_get_current_user] = lambda: FakeUser()

    with TestClient(app) as client:
        payload = {
            "key": "checkout_redesign",
            "name": "Checkout Redesign",
            "type": "boolean",
            "default_value": True,
            "enabled": True,
            "description": "Test flag",
            "owner_team": "Platform",
            "environment": "development",
            "actor": "qa@featureflow.local",
        }

        response = client.post("/flags", json=payload)

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["key"] == "checkout_redesign"
        assert body["environment"] == "development"
        assert body["enabled"] is True

        with testing_session() as database:
            environments = [
                Environment(name=name.title(), key=name, owner_id=FakeUser.id)
                for name in ("development", "staging", "production")
            ]
            database.add_all(environments)
            database.commit()
            environment_ids = {environment.key: environment.id for environment in environments}

        for environment, percentage in (
            ("development", 20),
            ("staging", 50),
            ("production", 10),
        ):
            override_response = client.put(
                f"/flags/{body['id']}/environments/{environment_ids[environment]}",
                json={"rollout_percentage": percentage},
            )
            assert override_response.status_code == 200, override_response.text

        overrides_response = client.get(f"/flags/{body['id']}/environments")
        assert overrides_response.status_code == 200, overrides_response.text
        assert {
            item["environment"]: item["rollout_percentage"]
            for item in overrides_response.json()
        } == {"development": 20, "staging": 50, "production": 10}

        update_response = client.put(
            f"/flags/{body['id']}",
            json={
                "key": "checkout_redesign",
                "name": "Checkout Redesign v2",
                "type": "boolean",
                "default_value": True,
                "description": "Updated test flag",
                "owner_team": "Growth",
                "enabled": True,
                "environment": "production",
                "rollout_percentage": 80,
            },
        )

        assert update_response.status_code == 200, update_response.text

        status_response = client.patch(
            f"/flags/{body['id']}/status",
            json={"enabled": False, "actor": "qa@featureflow.local"},
        )

        assert status_response.status_code == 200, status_response.text

        rollout_response = client.patch(
            f"/flags/{body['id']}/rollout",
            json={"rollout_percentage": 25, "actor": "qa@featureflow.local"},
        )

        assert rollout_response.status_code == 200, rollout_response.text

        target_add_response = client.post(
            f"/flags/{body['id']}/target-users",
            json={"user_id": "user_101"},
        )
        assert target_add_response.status_code == 201, target_add_response.text

        target_list_response = client.get(f"/flags/{body['id']}/target-users")
        assert target_list_response.status_code == 200, target_list_response.text
        assert target_list_response.json() == ["user_101"]

        target_remove_response = client.delete(f"/flags/{body['id']}/target-users/user_101")
        assert target_remove_response.status_code == 204, target_remove_response.text

        with testing_session() as database:
            beta_group = UserGroup(name="beta_users")
            database.add(beta_group)
            database.commit()
            database.refresh(beta_group)
            database.add(UserGroupMembership(user_id=str(FakeUser.id), group_id=beta_group.id))
            database.commit()

        group_add_response = client.post(
            f"/flags/{body['id']}/target-groups",
            json={"group_name": "beta_users"},
        )
        assert group_add_response.status_code == 201, group_add_response.text

        group_list_response = client.get(f"/flags/{body['id']}/target-groups")
        assert group_list_response.status_code == 200, group_list_response.text
        assert group_list_response.json() == ["beta_users"]

        disable_response = client.patch(
            f"/flags/{body['id']}/status",
            json={"enabled": False, "actor": "qa@featureflow.local"},
        )
        assert disable_response.status_code == 200, disable_response.text

        evaluation_response = client.post(
            "/evaluate",
            json={
                "flag_key": "checkout_redesign",
                "environment": "development",
                "user_context": {"user_id": str(FakeUser.id)},
            },
        )
        assert evaluation_response.status_code == 200, evaluation_response.text
        assert evaluation_response.json()["value"] is True

        group_remove_response = client.delete(f"/flags/{body['id']}/target-groups/beta_users")
        assert group_remove_response.status_code == 204, group_remove_response.text

        details_response = client.get(f"/flags/{body['id']}/details")

        assert details_response.status_code == 200, details_response.text
        details_body = details_response.json()
        actions = {log["action"] for log in details_body["audit_logs"]}
        assert "created" in actions
        assert "updated" in actions
        assert "disabled" in actions
        assert "rollout_changed" in actions
        assert "target_user_added" in actions
        assert "target_user_removed" in actions
        assert "target_group_added" in actions
        assert "target_group_removed" in actions

        delete_response = client.delete(f"/flags/{body['id']}")
        assert delete_response.status_code == 204, delete_response.text

        deleted_details_response = client.get(f"/flags/{body['id']}/details")
        assert deleted_details_response.status_code == 404

    Base.metadata.drop_all(engine)
