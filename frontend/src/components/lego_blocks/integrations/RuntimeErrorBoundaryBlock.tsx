import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  createRuntimeErrorReportBlock,
  type RuntimeErrorReportBlock,
} from '@/services/lego_blocks/units/runtimeErrorBlock'

interface RuntimeErrorBoundaryBlockProps {
  children: ReactNode
  location?: string | null
  onError?: (report: RuntimeErrorReportBlock) => void
  renderFallback?: (report: RuntimeErrorReportBlock) => ReactNode
}

interface RuntimeErrorBoundaryBlockState {
  report: RuntimeErrorReportBlock | null
}

export default class RuntimeErrorBoundaryBlock extends Component<
  RuntimeErrorBoundaryBlockProps,
  RuntimeErrorBoundaryBlockState
> {
  state: RuntimeErrorBoundaryBlockState = {
    report: null,
  }

  static getDerivedStateFromError(error: unknown): RuntimeErrorBoundaryBlockState {
    return {
      report: createRuntimeErrorReportBlock(error, {
        source: 'react-boundary',
        title: 'App render failure',
      }),
    }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    const report = createRuntimeErrorReportBlock(error, {
      source: 'react-boundary',
      title: 'App render failure',
      location: this.props.location,
      componentStack: errorInfo.componentStack,
    })
    this.setState({ report })
    this.props.onError?.(report)
  }

  render(): ReactNode {
    const { report } = this.state
    if (report) {
      return this.props.renderFallback?.(report) ?? null
    }
    return this.props.children
  }
}
