// Small CSV helpers for admin exports.

// columns: [{ label, value: (row) => any }]  (or { label, key })
export function toCSV(rows, columns) {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(r =>
    columns.map(c => esc(c.value ? c.value(r) : r[c.key])).join(',')
  )
  return [header, ...body].join('\r\n')
}

// Trigger a browser download. Prepends a UTF-8 BOM so Excel reads it correctly.
export function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
