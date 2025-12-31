'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogOut, Send, Bot, User as UserIcon } from 'lucide-react'

interface Message {
    role: 'user' | 'bot'
    text: string
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/auth')
            } else {
                setInitializing(false)
            }
        }
        checkAuth()
    }, [router])

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/auth')
    }

    const sendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!input.trim() || loading) return

        const userMsg = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', text: userMsg }])
        setLoading(true)

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userMsg }),
            })

            const data = await res.json()
            setMessages(prev => [...prev, { role: 'bot', text: data.answer }])
        } catch (err) {
            console.error(err)
            setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, checking the knowledge base failed.' }])
        } finally {
            setLoading(false)
        }
    }

    if (initializing) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>
    }

    return (
        <div className="min-h-screen flex flex-col max-w-4xl mx-auto p-4">
            {/* Header */}
            <header className="flex justify-between items-center py-4 px-6 bg-slate-900 rounded-xl mb-4 border border-slate-800">
                <div className="flex items-center gap-2">
                    <Bot className="w-6 h-6 text-blue-500" />
                    <h1 className="text-xl font-bold">Rag-Bot</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden mb-4 h-[600px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-slate-500 mt-20">
                            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Ask me anything about the documents!</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-4 rounded-2xl flex gap-3 ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                    }`}
                            >
                                {msg.role === 'bot' && <Bot className="w-5 h-5 mt-0.5 shrink-0 opacity-70" />}
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                {msg.role === 'user' && <UserIcon className="w-5 h-5 mt-0.5 shrink-0 opacity-70" />}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 text-slate-400 p-4 rounded-2xl rounded-tl-none flex gap-2 items-center">
                                <Bot className="w-5 h-5" />
                                <span className="animate-pulse">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur">
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your question..."
                            className="input-field"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
