'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle, AlertCircle, LogOut } from 'lucide-react'

export default function AdminPage() {
    const [authorized, setAuthorized] = useState(false)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
    const [files, setFiles] = useState<FileList | null>(null)
    const [info, setInfo] = useState<any>(null)

    const router = useRouter()
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/auth')
                return
            }
            if (user.email !== ADMIN_EMAIL) {
                setLoading(false) // Not authorized
            } else {
                setAuthorized(true)
                setLoading(false)
                fetchInfo()
            }
        }
        checkUser()
    }, [router, ADMIN_EMAIL])

    const fetchInfo = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/info`)
            const data = await res.json()
            setInfo(data)
        } catch (e) {
            console.error(e)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/auth')
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!files || files.length === 0) return

        setUploading(true)
        setStatus(null)

        const formData = new FormData()
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i])
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin-process-uploads`, {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()

            if (res.ok) {
                setStatus({
                    type: 'success',
                    msg: `Successfully processed ${files.length} files. Added ${data.added_chunks} chunks.`
                })
                fetchInfo()
                // Reset file input if possible, or just leave it
            } else {
                setStatus({ type: 'error', msg: 'Upload failed.' })
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'Network error.' })
        } finally {
            setUploading(false)
        }
    }

    if (loading) return <div className="p-10">Checking permissions...</div>

    if (!authorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-slate-400 mb-6">You are not authorized to view this page.</p>
                <button onClick={handleLogout} className="btn-primary">Logout</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8 bg-slate-950">
            <div className="max-w-3xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="bg-blue-600 p-2 rounded-lg"><FileText className="w-6 h-6 text-white" /></span>
                        Admin Dashboard
                    </h1>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </header>

                <div className="card mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b border-slate-800 pb-2">Upload Knowledge Base</h2>
                    <p className="text-sm text-slate-400 mb-6">
                        Upload PDF documents here. The system will extract text, chunk it, and add it to the global search index.
                    </p>

                    <form onSubmit={handleUpload} className="space-y-6">
                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-10 text-center hover:bg-slate-800/50 transition-colors">
                            <input
                                type="file"
                                accept="application/pdf"
                                multiple
                                onChange={(e) => setFiles(e.target.files)}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <Upload className="w-10 h-10 text-slate-500" />
                                <span className="text-slate-300 font-medium">Click to select PDF files</span>
                                <span className="text-slate-500 text-sm">
                                    {files && files.length > 0 ? `${files.length} files selected` : "or drag and drop"}
                                </span>
                            </label>
                        </div>

                        {files && files.length > 0 && (
                            <div className="bg-slate-800 p-3 rounded-lg flex items-center gap-2 text-sm text-slate-300">
                                <FileText className="w-4 h-4" />
                                {files.length} files ready to upload
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={uploading || !files}
                            className="w-full btn-primary disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {uploading ? 'Processing...' : 'Upload and Index'}
                        </button>
                    </form>

                    {status && (
                        <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${status.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/20' : 'bg-red-500/10 text-red-200 border border-red-500/20'
                            }`}>
                            {status.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
                            <p>{status.msg}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card">
                        <h3 className="text-sm font-medium text-slate-400 mb-1">Vector Store Status</h3>
                        <p className="text-2xl font-bold text-white">{info ? info.status : 'Loading...'}</p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-slate-400 mb-1">Backend URL</h3>
                        <p className="text-sm text-slate-300 font-mono truncate">{API_BASE}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
