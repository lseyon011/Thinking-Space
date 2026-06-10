import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { Options as ReactMarkdownOptions } from 'react-markdown'
import 'katex/dist/katex.min.css'

type RemarkPlugins = NonNullable<ReactMarkdownOptions['remarkPlugins']>
type RehypePlugins = NonNullable<ReactMarkdownOptions['rehypePlugins']>

export const markdownMathRemarkPluginsBlock: RemarkPlugins = [[remarkMath, { singleDollarTextMath: false }]]
export const markdownMathRehypePluginsBlock: RehypePlugins = [[rehypeKatex, { strict: false, output: 'html' }]]
