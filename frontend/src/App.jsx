import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'piboss_chat_history'
const MODE_KEY = 'piboss_chat_mode'

export default function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : [
        {
          role: 'assistant',
          content: '哟，来啦老弟/老妹！我是皮老板，你今天的快乐源泉已上线～ 想唠点啥？(≧▽≦)',
          id: 'welcome'
        }
      ]
    } catch {
      return [{ role: 'assistant', content: '哟，来啦！我是皮老板～ 想唠点啥？', id: 'welcome' }]
    }
  })

  const [mode, setMode] = useState(() => {
    return localStorage.getItem(MODE_KEY) || 'mild'
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleModeChange = (newMode) => {
    setMode(newMode)
  }

  const handleClear = () => {
    if (loading) return
    if (confirm('确定要清空对话吗？皮老板的金句可就没啦～')) {
      setMessages([
        {
          role: 'assistant',
          content: '哇，新的一页！之前的段子我都忘了（其实是被你清了嘿嘿），咱们重新唠！',
          id: Date.now().toString()
        }
      ])
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text, id: Date.now().toString() }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg = { role: 'assistant', content: '', id: assistantId }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    try {
      const historyForApi = messages
        .filter(m => m.id !== 'welcome' || messages.length <= 1)
        .map(m => ({ role: m.role, content: m.content }))
      historyForApi.push({ role: 'user', content: text })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          mode: mode
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            if (data.startsWith('[ERROR]')) {
              throw new Error(data.slice(8))
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                accumulated += parsed.content
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                ))
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (!accumulated) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: '（皮老板走神了一下下，啥也没说出来...再试一次？）' } : m
        ))
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `哎呀，皮老板的网络出了点小问题：${err.message}。检查下 backend 的 API_KEY 配了没？` }
          : m
      ))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <header className="header">
        <div className="header-title">
          <span className="logo">🤪</span>
          <h1>皮老板</h1>
          <span className="subtitle">陪你唠嗑解闷</span>
        </div>
        <div className="mode-switch">
          <span className="mode-label">调皮程度：</span>
          <button
            className={`mode-btn ${mode === 'mild' ? 'active' : ''}`}
            onClick={() => handleModeChange('mild')}
            disabled={loading}
          >
            温和
          </button>
          <button
            className={`mode-btn ${mode === 'naughty' ? 'active' : ''}`}
            onClick={() => handleModeChange('naughty')}
            disabled={loading}
          >
            很皮
          </button>
        </div>
      </header>

      {/* 聊天主体区 */}
      <main className="chat-area">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`msg-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
          >
            <div className={`bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              {msg.role === 'assistant' && <div className="avatar">🤪</div>}
              <div className="msg-content">
                {msg.content || (loading && msg.role === 'assistant' ? (
                  <span className="typing-dots">
                    <span></span><span></span><span></span>
                  </span>
                ) : '')}
              </div>
              {msg.role === 'user' && <div className="avatar-user">😎</div>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* 底部输入区 */}
      <footer className="input-area">
        <button className="clear-btn" onClick={handleClear} disabled={loading} title="清空对话">
          🗑️ 清空
        </button>
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="msg-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="跟皮老板说点啥吧...（Enter 发送，Shift+Enter 换行）"
            disabled={loading}
            rows={1}
          />
        </div>
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? '唠着...' : '发送'}
        </button>
      </footer>
    </div>
  )
}
