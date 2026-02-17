from app.services.lego_blocks.hierarchy_db_block import (
    HierarchyDbStatusBlock,
    get_hierarchy_db_status_block,
    init_hierarchy_db_block,
)
from app.services.lego_blocks.vault_path_block import get_vault_root_block


def initialize_hierarchy_db_orch() -> HierarchyDbStatusBlock:
    return init_hierarchy_db_block(get_vault_root_block())


def get_hierarchy_db_status_orch() -> HierarchyDbStatusBlock:
    return get_hierarchy_db_status_block(get_vault_root_block())
