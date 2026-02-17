from app.services.lego_blocks.hierarchy_db_block import connect_hierarchy_db_block
from app.services.lego_blocks.hierarchy_repo_block import (
    HierarchyEdgeBlock,
    HierarchyNodeBlock,
    HierarchyThoughtBlock,
    HierarchyThoughtLinkBlock,
    PathResolutionBlock,
    create_node_block,
    create_edge_block,
    create_thought_link_block,
    delete_node_block,
    delete_edge_block,
    delete_thought_link_block,
    get_node_block,
    list_nodes_block,
    list_edges_block,
    list_thought_links_block,
    list_thoughts_block,
    move_node_block,
    resolve_hierarchy_path_block,
    upsert_thought_block,
    update_node_block,
)
from app.services.lego_blocks.vault_path_block import get_vault_root_block


def list_nodes_orch(*, parent_id: str | None, node_type: str | None) -> list[HierarchyNodeBlock]:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return list_nodes_block(conn, parent_id=parent_id, node_type=node_type)


def get_node_orch(node_id: str) -> HierarchyNodeBlock:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return get_node_block(conn, node_id)


def create_node_orch(
    *,
    node_type: str,
    node_kind: str | None,
    title: str,
    parent_id: str | None,
    slug: str | None,
    sort_order: int,
) -> HierarchyNodeBlock:
    vault_root = get_vault_root_block()
    with connect_hierarchy_db_block(vault_root) as conn:
        return create_node_block(
            conn,
            vault_root=vault_root,
            node_type=node_type,
            node_kind=node_kind,
            title=title,
            parent_id=parent_id,
            slug=slug,
            sort_order=sort_order,
        )


def update_node_orch(
    *,
    node_id: str,
    node_type: str | None,
    node_kind: str | None,
    title: str | None,
    slug: str | None,
    sort_order: int | None,
) -> HierarchyNodeBlock:
    vault_root = get_vault_root_block()
    with connect_hierarchy_db_block(vault_root) as conn:
        return update_node_block(
            conn,
            vault_root=vault_root,
            node_id=node_id,
            node_type=node_type,
            node_kind=node_kind,
            title=title,
            slug=slug,
            sort_order=sort_order,
        )


def move_node_orch(*, node_id: str, new_parent_id: str | None, sort_order: int | None) -> HierarchyNodeBlock:
    vault_root = get_vault_root_block()
    with connect_hierarchy_db_block(vault_root) as conn:
        return move_node_block(
            conn,
            vault_root=vault_root,
            node_id=node_id,
            new_parent_id=new_parent_id,
            sort_order=sort_order,
        )


def delete_node_orch(node_id: str) -> None:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        delete_node_block(conn, node_id=node_id)


def upsert_thought_orch(*, file_path: str, title: str | None) -> HierarchyThoughtBlock:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return upsert_thought_block(conn, file_path=file_path, title=title)


def list_thoughts_orch(*, unlinked_only: bool, limit: int) -> list[HierarchyThoughtBlock]:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return list_thoughts_block(conn, unlinked_only=unlinked_only, limit=limit)


def create_thought_link_orch(
    *,
    thought_id: str,
    node_id: str,
    link_kind: str,
) -> HierarchyThoughtLinkBlock:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return create_thought_link_block(
            conn,
            thought_id=thought_id,
            node_id=node_id,
            link_kind=link_kind,
        )


def list_thought_links_orch(
    *,
    thought_id: str | None,
    node_id: str | None,
) -> list[HierarchyThoughtLinkBlock]:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return list_thought_links_block(conn, thought_id=thought_id, node_id=node_id)


def delete_thought_link_orch(link_id: str) -> bool:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return delete_thought_link_block(conn, link_id=link_id)


def create_edge_orch(
    *,
    from_node_id: str,
    to_node_id: str,
    edge_kind: str,
) -> HierarchyEdgeBlock:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return create_edge_block(
            conn,
            from_node_id=from_node_id,
            to_node_id=to_node_id,
            edge_kind=edge_kind,
        )


def list_edges_orch(
    *,
    from_node_id: str | None,
    to_node_id: str | None,
) -> list[HierarchyEdgeBlock]:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return list_edges_block(conn, from_node_id=from_node_id, to_node_id=to_node_id)


def delete_edge_orch(edge_id: str) -> bool:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return delete_edge_block(conn, edge_id=edge_id)


def resolve_hierarchy_path_orch(requested_path: str) -> PathResolutionBlock | None:
    with connect_hierarchy_db_block(get_vault_root_block()) as conn:
        return resolve_hierarchy_path_block(conn, requested_path)
