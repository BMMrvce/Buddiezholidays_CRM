import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useTable, useToast } from '../lib/hooks.jsx'

const BUCKET = 'gallery'
const MAX_MB = 8
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export default function Gallery() {
  const { data: images, loading, refetch } = useTable('gallery_images')
  const { show, Toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const fileRef = useRef(null)

  // gallery_images is ordered by created_at desc via useTable; resort by sort_order
  const ordered = [...images].sort((a, b) => (a.sort_order - b.sort_order) || (new Date(a.created_at) - new Date(b.created_at)))

  function pick() { fileRef.current?.click() }

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // allow re-selecting same file
    if (!files.length) return

    const valid = files.filter(f => {
      if (!ACCEPTED.includes(f.type)) { show(`${f.name}: unsupported type`, 'error'); return false }
      if (f.size > MAX_MB * 1024 * 1024) { show(`${f.name}: larger than ${MAX_MB}MB`, 'error'); return false }
      return true
    })
    if (!valid.length) return

    setUploading(true)
    setProgress({ done: 0, total: valid.length })
    let baseOrder = (ordered.at(-1)?.sort_order ?? ordered.length * 10) + 10
    let ok = 0

    for (const file of valid) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      })
      if (up.error) { show(`${file.name}: ${up.error.message}`, 'error'); setProgress(p => ({ ...p, done: p.done + 1 })); continue }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const ins = await supabase.from('gallery_images').insert([{
        storage_path: path, public_url: pub.publicUrl, sort_order: baseOrder, visible: true,
      }])
      if (ins.error) {
        // roll back the orphaned file if the row failed
        await supabase.storage.from(BUCKET).remove([path])
        show(`${file.name}: ${ins.error.message}`, 'error')
      } else { ok++; baseOrder += 10 }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    setUploading(false)
    if (ok) show(`${ok} image${ok > 1 ? 's' : ''} uploaded — live on the website ✓`)
    refetch()
  }

  async function toggleVisible(img) {
    const { error } = await supabase.from('gallery_images').update({ visible: !img.visible }).eq('id', img.id)
    if (error) show('Error: ' + error.message, 'error')
    else { show(img.visible ? 'Hidden from website' : 'Now visible on website'); refetch() }
  }

  async function saveCaption(img, caption) {
    if (caption === (img.caption || '')) return
    const { error } = await supabase.from('gallery_images').update({ caption }).eq('id', img.id)
    if (error) show('Error: ' + error.message, 'error')
    else refetch()
  }

  async function move(img, dir) {
    const idx = ordered.findIndex(x => x.id === img.id)
    const swapWith = ordered[idx + dir]
    if (!swapWith) return
    // swap sort_order values
    await Promise.all([
      supabase.from('gallery_images').update({ sort_order: swapWith.sort_order }).eq('id', img.id),
      supabase.from('gallery_images').update({ sort_order: img.sort_order }).eq('id', swapWith.id),
    ])
    refetch()
  }

  async function remove(img) {
    if (!confirm('Delete this image from the gallery? This removes it from the website too.')) return
    const { error } = await supabase.from('gallery_images').delete().eq('id', img.id)
    if (error) { show('Error: ' + error.message, 'error'); return }
    await supabase.storage.from(BUCKET).remove([img.storage_path])
    show('Image deleted'); refetch()
  }

  const visibleCount = images.filter(i => i.visible).length

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Website Gallery</div>
          <div className="page-sub">Upload photos here — they appear on the website instantly · {visibleCount} live / {images.length} total</div>
        </div>
        <button className="btn btn-primary" onClick={pick} disabled={uploading}>
          {uploading ? `Uploading ${progress.done}/${progress.total}…` : '+ Upload images'}
        </button>
        <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} multiple style={{ display: 'none' }} onChange={onFiles} />
      </div>

      {/* Dropzone / hint */}
      <div className="card" style={{ marginBottom: 16, borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer' }} onClick={pick}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
        <div style={{ fontWeight: 600 }}>Click to upload gallery photos</div>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
          JPG, PNG, WebP or AVIF · up to {MAX_MB}MB each · you can select multiple at once
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text2)' }}>Loading…</div>
      ) : ordered.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">🖼️</div>No images yet. Upload your first photos above.</div></div>
      ) : (
        <div className="gallery-grid">
          {ordered.map((img, i) => (
            <div key={img.id} className="card gallery-item" style={{ padding: 10, opacity: img.visible ? 1 : 0.55 }}>
              <div className="gallery-thumb">
                <img src={img.public_url} alt={img.caption || 'Gallery image'} loading="lazy" />
                {!img.visible && <span className="gallery-hidden-badge">Hidden</span>}
              </div>
              <input
                className="gallery-caption"
                defaultValue={img.caption || ''}
                placeholder="Add a caption (optional)"
                onBlur={e => saveCaption(img, e.target.value.trim())}
              />
              <div className="gallery-actions">
                <button className="btn btn-sm" disabled={i === 0} onClick={() => move(img, -1)} title="Move earlier">↑</button>
                <button className="btn btn-sm" disabled={i === ordered.length - 1} onClick={() => move(img, 1)} title="Move later">↓</button>
                <button className="btn btn-sm" onClick={() => toggleVisible(img)}>{img.visible ? 'Hide' : 'Show'}</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(img)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
