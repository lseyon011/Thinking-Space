import type { NodeRecord } from './dbBlock'
import type {
  NodePriority,
  NodeStatus,
  NodeType,
  YAMLCommentEntry,
  YAMLFrontmatter,
} from './yamlNoteBlock'
import type {
  CleanResult,
  ConvertOptions,
  FormatOptions,
  FormatPreviewData,
  FormatResult,
  PdfConvertResult,
  PdfPreviewData,
  TranscriptOptions,
} from './typesBlock'

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
  | 'thoughts.create'
  | 'todos.create'
  | 'todos.toggle'
  | 'tools.files.list_markdown'
  | 'tools.files.list_pdf'
  | 'tools.folders.list'
  | 'tools.excalidraw.preview'
  | 'tools.excalidraw.format'
  | 'tools.pdf.preview'
  | 'tools.pdf.convert'
  | 'tools.transcript.preview'
  | 'tools.transcript.clean_save'

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
    extraFields?: Record<string, unknown>
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
      extraFields?: Record<string, unknown>
    }
  }
  'organizer.node.move': {
    uuid: string
    newParentKey: string | null
  }
  'organizer.node.delete': {
    uuid: string
  }
  'thoughts.create': {
    folder_path: string
    filename: string
    content: string
    title: string | null
    date_header: boolean
    emotions: string[]
  }
  'todos.create': {
    folderPath: string
    date: string
    items: string[]
  }
  'todos.toggle': {
    filePath: string
    lineNumber: number
  }
  'tools.files.list_markdown': {
    limit?: number
  }
  'tools.files.list_pdf': {
    limit?: number
  }
  'tools.folders.list': {
    limit?: number
  }
  'tools.excalidraw.preview': {
    inputPath: string
    options: FormatOptions
  }
  'tools.excalidraw.format': {
    inputPath: string
    options: FormatOptions
  }
  'tools.pdf.preview': {
    inputPath: string
    options: ConvertOptions
  }
  'tools.pdf.convert': {
    inputPath: string
    options: ConvertOptions
  }
  'tools.transcript.preview': {
    inputText: string
    headingsText: string
    options: TranscriptOptions
  }
  'tools.transcript.clean_save': {
    input_text: string
    headings_text: string
    output_folder: string
    output_name: string
    base_folder: string | null
    options: TranscriptOptions
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
    preview?: {
      nodeUuid: string
      fromParentKey: string | null
      toParentKey: string | null
      touchedPaths: string[]
    }
  }
  'organizer.node.delete': {
    deleted: true
    preview?: {
      nodeUuid: string
      filePath?: string
      parentKey: string | null
      childCount: number
      touchedPaths: string[]
    }
  }
  'thoughts.create': {
    output_path: string
  }
  'todos.create': {
    output_path: string
    items_added: number
  }
  'todos.toggle': {
    toggled: true
    filePath: string
  }
  'tools.files.list_markdown': {
    files: string[]
  }
  'tools.files.list_pdf': {
    files: string[]
  }
  'tools.folders.list': {
    folders: string[]
  }
  'tools.excalidraw.preview': {
    preview: FormatPreviewData
  }
  'tools.excalidraw.format': {
    result: FormatResult
  }
  'tools.pdf.preview': {
    preview: PdfPreviewData
  }
  'tools.pdf.convert': {
    result: PdfConvertResult
  }
  'tools.transcript.preview': {
    result: CleanResult
  }
  'tools.transcript.clean_save': {
    result: CleanResult
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
  {
    name: 'thoughts.create',
    description: 'Create a thought markdown note with YAML metadata.',
    readOnly: false,
  },
  {
    name: 'todos.create',
    description: 'Create or append todos into a daily todo markdown note.',
    readOnly: false,
  },
  {
    name: 'todos.toggle',
    description: 'Toggle a single todo checkbox in a file.',
    readOnly: false,
  },
  {
    name: 'tools.files.list_markdown',
    description: 'List markdown files in the vault.',
    readOnly: true,
  },
  {
    name: 'tools.files.list_pdf',
    description: 'List PDF files in the vault.',
    readOnly: true,
  },
  {
    name: 'tools.folders.list',
    description: 'List folder paths in the vault.',
    readOnly: true,
  },
  {
    name: 'tools.excalidraw.preview',
    description: 'Preview markdown formatting for Excalidraw import.',
    readOnly: true,
  },
  {
    name: 'tools.excalidraw.format',
    description: 'Format markdown for Excalidraw and persist output file.',
    readOnly: false,
  },
  {
    name: 'tools.pdf.preview',
    description: 'Preview PDF to markdown conversion.',
    readOnly: true,
  },
  {
    name: 'tools.pdf.convert',
    description: 'Convert PDF to markdown and persist output file.',
    readOnly: false,
  },
  {
    name: 'tools.transcript.preview',
    description: 'Preview transcript cleanup output.',
    readOnly: true,
  },
  {
    name: 'tools.transcript.clean_save',
    description: 'Clean a transcript and save markdown output.',
    readOnly: false,
  },
]

export function getCapabilityDefinition(name: CapabilityName): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY.find(capability => capability.name === name)
}
