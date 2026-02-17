from app.services.lego_blocks.hierarchy_db_block import connect_hierarchy_db_block, init_hierarchy_db_block
from app.services.lego_blocks.hierarchy_repo_block import (
    create_node_block,
    create_thought_link_block,
    delete_thought_link_block,
    list_nodes_block,
    list_thought_links_block,
    move_node_block,
    upsert_thought_block,
)


def test_hierarchy_sqlite_write_paths(tmp_path):
    vault_root = tmp_path
    status = init_hierarchy_db_block(vault_root)
    assert status.initialized is True
    assert status.exists is True

    with connect_hierarchy_db_block(vault_root) as conn:
        project = create_node_block(
            conn,
            vault_root=vault_root,
            node_type="project",
            title="Project A",
            parent_id=None,
            slug=None,
            sort_order=0,
        )
        epic = create_node_block(
            conn,
            vault_root=vault_root,
            node_type="epic",
            title="Epic A",
            parent_id=project.id,
            slug=None,
            sort_order=0,
        )
        idea = create_node_block(
            conn,
            vault_root=vault_root,
            node_type="idea",
            title="Idea A",
            parent_id=epic.id,
            slug=None,
            sort_order=0,
        )

        children = list_nodes_block(conn, parent_id=epic.id, node_type=None)
        assert any(node.id == idea.id for node in children)

        project_b = create_node_block(
            conn,
            vault_root=vault_root,
            node_type="project",
            title="Project B",
            parent_id=None,
            slug=None,
            sort_order=1,
        )
        moved_epic = move_node_block(
            conn,
            vault_root=vault_root,
            node_id=epic.id,
            new_parent_id=project_b.id,
            sort_order=0,
        )
        assert "/projects/project-b/epics/" in moved_epic.file_path

        thought = upsert_thought_block(
            conn,
            file_path="acceleration_core/F9/thoughts/2026-02-14.md",
            title="Thought one",
        )
        link = create_thought_link_block(
            conn,
            thought_id=thought.id,
            node_id=idea.id,
            link_kind="context",
        )
        links = list_thought_links_block(conn, thought_id=thought.id, node_id=None)
        assert any(item.id == link.id for item in links)
        assert delete_thought_link_block(conn, link.id) is True

