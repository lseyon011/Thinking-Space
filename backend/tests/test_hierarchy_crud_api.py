from fastapi.testclient import TestClient

from app.main import app


def test_hierarchy_node_crud_and_move(tmp_path, monkeypatch):
    monkeypatch.setenv("LTM_PILOT_VAULT_ROOT", str(tmp_path))
    client = TestClient(app)

    assert client.post("/api/hierarchy/init").status_code == 200

    project = client.post(
        "/api/hierarchy/nodes",
        json={"type": "project", "title": "Personal Growth"},
    )
    assert project.status_code == 200
    project_data = project.json()
    assert project_data["file_path"].startswith(".ltm-pilot/thinking_organizer/projects/personal-growth/")
    project_file = tmp_path / project_data["file_path"]
    assert project_file.exists()

    epic = client.post(
        "/api/hierarchy/nodes",
        json={"type": "epic", "title": "Build Thinking Space", "parent_id": project_data["id"]},
    )
    assert epic.status_code == 200
    epic_data = epic.json()
    assert "/epics/build-thinking-space/" in epic_data["file_path"]
    epic_file_before = tmp_path / epic_data["file_path"]
    assert epic_file_before.exists()
    epic_file_before.write_text("# Epic moved content\n", encoding="utf-8")

    idea = client.post(
        "/api/hierarchy/nodes",
        json={"type": "idea", "title": "Hierarchy Model", "parent_id": epic_data["id"]},
    )
    assert idea.status_code == 200
    idea_data = idea.json()
    assert idea_data["file_path"].endswith("/ideas/hierarchy-model.md")
    idea_file_before = tmp_path / idea_data["file_path"]
    assert idea_file_before.exists()
    idea_file_before.write_text("# Idea moved content\n", encoding="utf-8")

    another_project = client.post(
        "/api/hierarchy/nodes",
        json={"type": "project", "title": "Work Client X"},
    )
    assert another_project.status_code == 200
    another_project_data = another_project.json()

    moved_epic = client.post(
        f"/api/hierarchy/nodes/{epic_data['id']}/move",
        json={"new_parent_id": another_project_data["id"]},
    )
    assert moved_epic.status_code == 200
    moved_epic_data = moved_epic.json()
    assert moved_epic_data["file_path"].startswith(".ltm-pilot/thinking_organizer/projects/work-client-x/epics/")
    moved_epic_path = tmp_path / moved_epic_data["file_path"]
    assert moved_epic_path.exists()
    assert moved_epic_path.read_text(encoding="utf-8") == "# Epic moved content\n"
    assert not epic_file_before.exists()

    moved_idea = client.get(f"/api/hierarchy/nodes/{idea_data['id']}")
    assert moved_idea.status_code == 200
    moved_idea_data = moved_idea.json()
    assert moved_idea_data["file_path"].startswith(".ltm-pilot/thinking_organizer/projects/work-client-x/epics/")
    moved_idea_path = tmp_path / moved_idea_data["file_path"]
    assert moved_idea_path.exists()
    assert moved_idea_path.read_text(encoding="utf-8") == "# Idea moved content\n"
    assert not idea_file_before.exists()

    resolved_old_epic = client.get(
        "/api/hierarchy/path/resolve",
        params={"path": epic_data["file_path"]},
    )
    assert resolved_old_epic.status_code == 200
    resolved_old_epic_data = resolved_old_epic.json()
    assert resolved_old_epic_data["found"] is True
    assert resolved_old_epic_data["resolved_path"] == moved_epic_data["file_path"]
    assert resolved_old_epic_data["target_id"] == epic_data["id"]
    assert resolved_old_epic_data["via_alias"] is True


def test_nested_idea_levels_are_supported(tmp_path, monkeypatch):
    monkeypatch.setenv("LTM_PILOT_VAULT_ROOT", str(tmp_path))
    client = TestClient(app)

    assert client.post("/api/hierarchy/init").status_code == 200

    project = client.post(
        "/api/hierarchy/nodes",
        json={"type": "project", "title": "Nested Project"},
    ).json()
    epic = client.post(
        "/api/hierarchy/nodes",
        json={"type": "epic", "title": "Epic", "parent_id": project["id"]},
    ).json()
    idea = client.post(
        "/api/hierarchy/nodes",
        json={"type": "idea", "title": "Idea", "parent_id": epic["id"]},
    ).json()

    bucket = client.post(
        "/api/hierarchy/nodes",
        json={"type": "idea", "title": "Thought Bucket", "parent_id": idea["id"]},
    )
    assert bucket.status_code == 200
    bucket_data = bucket.json()
    assert "/ideas/idea/thought-bucket.md" in bucket_data["file_path"]


def test_thought_linking_flow(tmp_path, monkeypatch):
    monkeypatch.setenv("LTM_PILOT_VAULT_ROOT", str(tmp_path))
    client = TestClient(app)

    assert client.post("/api/hierarchy/init").status_code == 200

    project = client.post(
        "/api/hierarchy/nodes",
        json={"type": "project", "title": "Personal Growth"},
    ).json()
    epic = client.post(
        "/api/hierarchy/nodes",
        json={"type": "epic", "title": "Build Thinking Space", "parent_id": project["id"]},
    ).json()
    idea = client.post(
        "/api/hierarchy/nodes",
        json={"type": "idea", "title": "In App Feature Builder", "parent_id": epic["id"]},
    ).json()

    thought = client.post(
        "/api/hierarchy/thoughts/upsert",
        json={"file_path": "inbox/2026-02-13-free-thought.md", "title": "free thought"},
    )
    assert thought.status_code == 200
    thought_data = thought.json()

    unlinked_before = client.get("/api/hierarchy/thoughts?unlinked_only=true").json()
    assert any(item["id"] == thought_data["id"] for item in unlinked_before)

    link = client.post(
        "/api/hierarchy/thought-links",
        json={"thought_id": thought_data["id"], "node_id": idea["id"], "link_kind": "context"},
    )
    assert link.status_code == 200
    link_data = link.json()

    links = client.get(f"/api/hierarchy/thought-links?thought_id={thought_data['id']}")
    assert links.status_code == 200
    assert len(links.json()) == 1

    unlinked_after = client.get("/api/hierarchy/thoughts?unlinked_only=true").json()
    assert all(item["id"] != thought_data["id"] for item in unlinked_after)

    deleted = client.delete(f"/api/hierarchy/thought-links/{link_data['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["success"] is True
