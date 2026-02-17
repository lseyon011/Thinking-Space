import type { NodeRecord } from './dbBlock'
import type {
  NodePriority,
  NodeStatus,
  NodeType,
  YAMLCommentEntry,
  YAMLFrontmatter,
} from './yamlNoteBlock'

export interface CapabilityActor {
  kind: 'human' | 'agent' | 'system'
  id?: string
}

export type CapabilityName =
  | 'organizer.nodes.list_roots'
  | 'organizer.nodes.list_children'
  | 'organizer.nodes.list_all'
  | 'organizer.nodes.search'
  | 'organizer.node.get'
  | 'organizer.node.get_by_key'
  | 'organizer.node.read_frontmatter'
  | 'organizer.node.create'
  | 'organizer.node.rename'
  | 'organizer.node.update'
  | 'organizer.node.move'
  | 'organizer.node.delete'

export interface CapabilityInputMap {
  'organizer.nodes.list_roots': {
    typeFilter?: NodeType
  }
  'organizer.nodes.list_children': {
    parentKey: string
  }
  'organizer.nodes.list_all': Record<string, never>
  'organizer.nodes.search': {
    query: string
    limit?: number
  }
  'organizer.node.get': {
    uuid: string
  }
  'organizer.node.get_by_key': {
    key: string
  }
  'organizer.node.read_frontmatter': {
    filePath: string
  }
  'organizer.node.create': {
    type: NodeType
    title: string
    parentKey?: string
    parentUuid?: string
    parentType?: NodeType
    tags?: string[]
    body?: string
    description?: string
    comments?: Array<string | YAMLCommentEntry>
    projectRoot?: string
  }
  'organizer.node.rename': {
    uuid: string
    newTitle: string
  }
  'organizer.node.update': {
    uuid: string
    updates: {
      type?: NodeType
      title?: string
      tags?: string[]
      status?: NodeStatus
      priority?: NodePriority
      description?: string
      comments?: Array<string | YAMLCommentEntry>
    }
  }
  'organizer.node.move': {
    uuid: string
    newParentKey: string | null
  }
  'organizer.node.delete': {
    uuid: string
  }
}

export interface CapabilityOutputMap {
  'organizer.nodes.list_roots': {
    nodes: NodeRecord[]
  }
  'organizer.nodes.list_children': {
    nodes: NodeRecord[]
  }
  'organizer.nodes.list_all': {
    nodes: NodeRecord[]
  }
  'organizer.nodes.search': {
    nodes: NodeRecord[]
  }
  'organizer.node.get': {
    node: NodeRecord | null
  }
  'organizer.node.get_by_key': {
    node: NodeRecord | null
  }
  'organizer.node.read_frontmatter': {
    frontmatter: YAMLFrontmatter | null
  }
  'organizer.node.create': {
    node: NodeRecord
  }
  'organizer.node.rename': {
    node: NodeRecord
  }
  'organizer.node.update': {
    node: NodeRecord
  }
  'organizer.node.move': {
    node: NodeRecord
  }
  'organizer.node.delete': {
    deleted: true
  }
}

export interface CapabilityDefinition {
  name: CapabilityName
  description: string
  readOnly: boolean
}

export const CAPABILITY_REGISTRY: CapabilityDefinition[] = [
  {
    name: 'organizer.nodes.list_roots',
    description: 'List root nodes in the organizer hierarchy, optionally filtered by type.',
    readOnly: true,
  },
  {
    name: 'organizer.nodes.list_children',
    description: 'List children for a parent node key.',
    readOnly: true,
  },
  {
    name: 'organizer.nodes.list_all',
    description: 'List all organizer nodes from cache.',
    readOnly: true,
  },
  {
    name: 'organizer.nodes.search',
    description: 'Search organizer nodes by lexical query.',
    readOnly: true,
  },
  {
    name: 'organizer.node.get',
    description: 'Get an organizer node by uuid.',
    readOnly: true,
  },
  {
    name: 'organizer.node.get_by_key',
    description: 'Get an organizer node by key.',
    readOnly: true,
  },
  {
    name: 'organizer.node.read_frontmatter',
    description: 'Read YAML frontmatter by file path.',
    readOnly: true,
  },
  {
    name: 'organizer.node.create',
    description: 'Create a hierarchy node and persist it to YAML + cache.',
    readOnly: false,
  },
  {
    name: 'organizer.node.rename',
    description: 'Rename a node title.',
    readOnly: false,
  },
  {
    name: 'organizer.node.update',
    description: 'Update node metadata fields.',
    readOnly: false,
  },
  {
    name: 'organizer.node.move',
    description: 'Move a node to a new parent key.',
    readOnly: false,
  },
  {
    name: 'organizer.node.delete',
    description: 'Delete a node from cache/source of truth workflow.',
    readOnly: false,
  },
]

export function getCapabilityDefinition(name: CapabilityName): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY.find(capability => capability.name === name)
}
