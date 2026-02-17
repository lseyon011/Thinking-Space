from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.lego_blocks.hierarchy_repo_block import (
    HierarchyNotFoundError,
    HierarchyRepoError,
    HierarchyValidationError,
)
from app.services.orchestrators.hierarchy_db_orch import (
    get_hierarchy_db_status_orch,
    initialize_hierarchy_db_orch,
)
from app.services.orchestrators.hierarchy_orch import (
    create_edge_orch,
    create_node_orch,
    create_thought_link_orch,
    delete_node_orch,
    delete_thought_link_orch,
    get_node_orch,
    list_nodes_orch,
    list_thought_links_orch,
    list_thoughts_orch,
    move_node_orch,
    resolve_hierarchy_path_orch,
    upsert_thought_orch,
    update_node_orch,
)

router = APIRouter()

NodeType = Literal["project", "epic", "idea"]


class HierarchyDbStatusResponse(BaseModel):
    db_path: str
    exists: bool
    initialized: bool
    schema_version: int
    applied_migrations: list[str]
    last_migration_id: str | None


class HierarchyNodeResponse(BaseModel):
    id: str
    type: NodeType
    node_kind: str
    title: str
    slug: str
    parent_id: str | None
    file_path: str
    sort_order: int
    created_at: str
    updated_at: str


class CreateNodeRequest(BaseModel):
    type: NodeType
    node_kind: str | None = None
    title: str = Field(..., min_length=1)
    parent_id: str | None = None
    slug: str | None = None
    sort_order: int = 0


class UpdateNodeRequest(BaseModel):
    type: NodeType | None = None
    node_kind: str | None = None
    title: str | None = None
    slug: str | None = None
    sort_order: int | None = None


class MoveNodeRequest(BaseModel):
    new_parent_id: str | None = None
    sort_order: int | None = None


class DeleteNodeResponse(BaseModel):
    success: bool


class ThoughtResponse(BaseModel):
    id: str
    title: str | None
    slug: str
    file_path: str
    status: str
    created_at: str
    updated_at: str
    link_count: int


class UpsertThoughtRequest(BaseModel):
    file_path: str = Field(..., min_length=1)
    title: str | None = None


class ThoughtLinkResponse(BaseModel):
    id: str
    thought_id: str
    node_id: str
    link_kind: str
    created_at: str


class CreateThoughtLinkRequest(BaseModel):
    thought_id: str
    node_id: str
    link_kind: str = "context"


class DeleteThoughtLinkResponse(BaseModel):
    success: bool


class EdgeResponse(BaseModel):
    id: str
    from_node_id: str
    to_node_id: str
    edge_kind: str
    created_at: str


class CreateEdgeRequest(BaseModel):
    from_node_id: str
    to_node_id: str
    edge_kind: str = "related"


class DeleteEdgeResponse(BaseModel):
    success: bool


class PathResolveResponse(BaseModel):
    requested_path: str
    found: bool
    resolved_path: str | None = None
    target_type: Literal["node", "thought"] | None = None
    target_id: str | None = None
    via_alias: bool = False


def _raise_mapped_error(err: Exception) -> None:
    if isinstance(err, HierarchyNotFoundError):
        raise HTTPException(status_code=404, detail=str(err))
    if isinstance(err, HierarchyValidationError):
        raise HTTPException(status_code=400, detail=str(err))
    if isinstance(err, HierarchyRepoError):
        raise HTTPException(status_code=500, detail=str(err))
    raise HTTPException(status_code=500, detail=str(err))


@router.get("/status", response_model=HierarchyDbStatusResponse)
async def get_hierarchy_db_status():
    return HierarchyDbStatusResponse(**get_hierarchy_db_status_orch().to_dict())


@router.post("/init", response_model=HierarchyDbStatusResponse)
async def initialize_hierarchy_db():
    return HierarchyDbStatusResponse(**initialize_hierarchy_db_orch().to_dict())


@router.get("/nodes", response_model=list[HierarchyNodeResponse])
async def list_nodes(
    parent_id: str | None = Query(default=None),
    type: NodeType | None = Query(default=None),
):
    try:
        rows = list_nodes_orch(parent_id=parent_id, node_type=type)
        return [HierarchyNodeResponse(**row.to_dict()) for row in rows]
    except Exception as err:
        _raise_mapped_error(err)


@router.get("/nodes/{node_id}", response_model=HierarchyNodeResponse)
async def get_node(node_id: str):
    try:
        return HierarchyNodeResponse(**get_node_orch(node_id).to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.post("/nodes", response_model=HierarchyNodeResponse)
async def create_node(request: CreateNodeRequest):
    try:
        node = create_node_orch(
            node_type=request.type,
            node_kind=request.node_kind,
            title=request.title,
            parent_id=request.parent_id,
            slug=request.slug,
            sort_order=request.sort_order,
        )
        return HierarchyNodeResponse(**node.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.patch("/nodes/{node_id}", response_model=HierarchyNodeResponse)
async def update_node(node_id: str, request: UpdateNodeRequest):
    try:
        node = update_node_orch(
            node_id=node_id,
            node_type=request.type,
            node_kind=request.node_kind,
            title=request.title,
            slug=request.slug,
            sort_order=request.sort_order,
        )
        return HierarchyNodeResponse(**node.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.post("/nodes/{node_id}/move", response_model=HierarchyNodeResponse)
async def move_node(node_id: str, request: MoveNodeRequest):
    try:
        node = move_node_orch(
            node_id=node_id,
            new_parent_id=request.new_parent_id,
            sort_order=request.sort_order,
        )
        return HierarchyNodeResponse(**node.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.delete("/nodes/{node_id}", response_model=DeleteNodeResponse)
async def delete_node(node_id: str):
    try:
        delete_node_orch(node_id)
        return DeleteNodeResponse(success=True)
    except Exception as err:
        _raise_mapped_error(err)


@router.post("/thoughts/upsert", response_model=ThoughtResponse)
async def upsert_thought(request: UpsertThoughtRequest):
    try:
        thought = upsert_thought_orch(file_path=request.file_path, title=request.title)
        return ThoughtResponse(**thought.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.get("/thoughts", response_model=list[ThoughtResponse])
async def list_thoughts(
    unlinked_only: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=1000),
):
    try:
        rows = list_thoughts_orch(unlinked_only=unlinked_only, limit=limit)
        return [ThoughtResponse(**row.to_dict()) for row in rows]
    except Exception as err:
        _raise_mapped_error(err)


@router.get("/thought-links", response_model=list[ThoughtLinkResponse])
async def list_thought_links(
    thought_id: str | None = Query(default=None),
    node_id: str | None = Query(default=None),
):
    try:
        rows = list_thought_links_orch(thought_id=thought_id, node_id=node_id)
        return [ThoughtLinkResponse(**row.to_dict()) for row in rows]
    except Exception as err:
        _raise_mapped_error(err)


@router.post("/thought-links", response_model=ThoughtLinkResponse)
async def create_thought_link(request: CreateThoughtLinkRequest):
    try:
        row = create_thought_link_orch(
            thought_id=request.thought_id,
            node_id=request.node_id,
            link_kind=request.link_kind,
        )
        return ThoughtLinkResponse(**row.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.delete("/thought-links/{link_id}", response_model=DeleteThoughtLinkResponse)
async def delete_thought_link(link_id: str):
    try:
        deleted = delete_thought_link_orch(link_id)
        return DeleteThoughtLinkResponse(success=deleted)
    except Exception as err:
        _raise_mapped_error(err)


@router.get("/edges", response_model=list[EdgeResponse])
async def list_edges(
    from_node_id: str | None = Query(default=None),
    to_node_id: str | None = Query(default=None),
):
    try:
        rows = list_edges_orch(from_node_id=from_node_id, to_node_id=to_node_id)
        return [EdgeResponse(**row.to_dict()) for row in rows]
    except Exception as err:
        _raise_mapped_error(err)


@router.post("/edges", response_model=EdgeResponse)
async def create_edge(request: CreateEdgeRequest):
    try:
        row = create_edge_orch(
            from_node_id=request.from_node_id,
            to_node_id=request.to_node_id,
            edge_kind=request.edge_kind,
        )
        return EdgeResponse(**row.to_dict())
    except Exception as err:
        _raise_mapped_error(err)


@router.delete("/edges/{edge_id}", response_model=DeleteEdgeResponse)
async def delete_edge(edge_id: str):
    try:
        delete_edge_orch(edge_id)
        return DeleteEdgeResponse(success=True)
    except Exception as err:
        _raise_mapped_error(err)


@router.get("/path/resolve", response_model=PathResolveResponse)
async def resolve_path(path: str = Query(..., min_length=1)):
    try:
        resolved = resolve_hierarchy_path_orch(path)
        if resolved is None:
            return PathResolveResponse(requested_path=path, found=False)
        return PathResolveResponse(
            requested_path=resolved.requested_path,
            found=True,
            resolved_path=resolved.resolved_path,
            target_type=resolved.target_type,
            target_id=resolved.target_id,
            via_alias=resolved.via_alias,
        )
    except Exception as err:
        _raise_mapped_error(err)
    delete_edge_orch,
    list_edges_orch,
