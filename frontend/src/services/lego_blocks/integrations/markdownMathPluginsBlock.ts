import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export const markdownMathRemarkPluginsBlock = [remarkMath] as const
export const markdownMathRehypePluginsBlock = [[rehypeKatex, { strict: false, output: 'html' }]] as const
