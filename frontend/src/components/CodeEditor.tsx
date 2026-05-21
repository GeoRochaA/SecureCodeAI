import React, { useMemo } from 'react'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-markup'

interface CodeEditorProps {
  value: string
  onValueChange: (code: string) => void
  language: string
  placeholder?: string
  readOnly?: boolean
}

const languageMap: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  php: 'javascript',
  sql: 'sql',
  html: 'markup',
  css: 'css',
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onValueChange, language, placeholder, readOnly = false }) => {
  const prismLanguage = useMemo(() => languageMap[language.toLowerCase()] || 'javascript', [language])
  const lines = useMemo(() => value.split('\n'), [value])

  const highlight = (code: string) => {
    try {
      const grammar = Prism.languages[prismLanguage]
      if (!grammar) {
        return code
      }
      return Prism.highlight(code, grammar, prismLanguage)
    } catch {
      return code
    }
  }

  return (
    <div className="code-editor rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="grid grid-cols-[minmax(48px,auto)_1fr]">
        <div className="line-numbers hidden sm:block bg-slate-900 px-3 py-4 text-right text-xs text-slate-500 select-none">
          {lines.map((_, index) => (
            <div key={index} className="leading-6">{index + 1}</div>
          ))}
        </div>
        <Editor
          value={value}
          onValueChange={onValueChange}
          highlight={highlight}
          padding={16}
          textareaId="code-editor"
          placeholder={placeholder}
          readOnly={readOnly}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
            fontSize: 14,
            minHeight: 360,
            outline: 'none',
            color: '#e2e8f0',
            backgroundColor: 'transparent',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  )
}

export default CodeEditor
