import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const PHOTO_LABELS = {
  photo_applicant_with_fish:  'Applicant with fish at time of capture',
  photo_applicant_on_scales:  'Applicant with fish on scales',
  photo_fish_on_scales:       'Fish on scales with weight clearly showing',
  photo_species_diagnostic:   'Species diagnostic photo(s)',
  photo_length_under:         'Fish length — tape measure under fish',
  photo_height:               'Fish height with tape measure',
  photo_length_over:          'Fish length — tape measure over fish',
  photo_girth:                'Fish girth with tape measure',
  photo_scales_sticker:       'Certification sticker on scales',
}

function Row({ label, value }) {
  if (!value && value !== false) return null
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="value">{value === true ? '✓ Yes' : value === false ? '✗ No' : value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  )
}

export default function ApplicationArchive() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState({})
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    supabase.from('record_applications').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setApp(data)
        setLoading(false)
      })
  }, [id])

  const handlePrint = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 300)
  }

  const exportToWord = () => {
    // Build a Word-compatible HTML document with all fields and inline images
    const fv = (v) => {
      if (v == null || v === '') return '<em style="color:#999">—</em>'
      if (v === true) return '✓ Yes'
      if (v === false) return '✗ No'
      return String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    const row = (label, value) => {
      if (!value && value !== false && value !== true) return ''
      return `<tr><td style="width:200px;padding:5px 10px 5px 0;color:#555;font-weight:500;vertical-align:top">${label}</td><td style="padding:5px 0;color:#111">${fv(value)}</td></tr>`
    }

    const section = (title, rows) => `
      <h3 style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${SNZ_BLUE};border-left:3px solid ${SNZ_BLUE};padding:4px 0 4px 10px;margin:20px 0 8px">${title}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>`

    const photoGrid = Object.entries(PHOTO_LABELS).map(([key, label]) => {
      const url = app[key]
      return `<td style="width:33%;padding:6px;vertical-align:top">
        ${url
          ? `<img src="${url}" style="width:100%;max-width:200px;height:140px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb" />`
          : `<div style="width:100%;max-width:200px;height:140px;border:2px dashed #fca5a5;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:11px;color:#ef4444;border-radius:4px">Not submitted</div>`
        }
        <p style="font-size:10px;color:#6b7280;margin-top:3px">${label}</p>
      </td>`
    })

    // Build 3-column rows of photos
    const photoRows = []
    for (let i = 0; i < photoGrid.length; i += 3) {
      photoRows.push(`<tr>${photoGrid.slice(i, i + 3).join('')}</tr>`)
    }

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
        <style>
          body { font-family: Arial, sans-serif; margin: 2cm; color: #111; }
          table { border-collapse: collapse; }
        </style>
      </head>
      <body>
        <table style="width:100%;border-bottom:3px solid ${SNZ_BLUE};padding-bottom:16px;margin-bottom:20px">
          <tr>
            <td>${SNZ_LOGO ? `<img src="${SNZ_LOGO}" style="height:50px;object-fit:contain" />` : ''}</td>
            <td style="padding-left:16px">
              <div style="font-size:20px;font-weight:900;color:#111">NZ Spearfishing Record Application</div>
              <div style="font-size:11px;color:#888;letter-spacing:.08em;text-transform:uppercase">Spearfishing New Zealand · Official Record</div>
            </td>
            <td style="text-align:right;font-size:11px;color:#888;line-height:1.8">
              ID #${app.id}<br>
              ${new Date(app.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
              <strong>Status: ${app.status}</strong><br>
              Type: ${app.app_type}
            </td>
          </tr>
        </table>

        ${section('Applicant Details', [
          row('Full name', app.full_name),
          row('Email', app.email),
          row('Cell phone', app.cell_phone),
          row('Telephone', app.telephone),
          row('Date of birth', app.birth_date),
          row('Postal address', app.postal_address),
        ].join(''))}

        ${section('Species & Measurements', [
          row('Common name', app.common_name),
          row('Scientific name', app.scientific_name),
          row('Weight (applicant)', app.weight_kg ? app.weight_kg + ' kg' : null),
          row('Length', app.length_cm ? app.length_cm + ' cm' : null),
          row('Girth at pectoral fin', app.girth_cm ? app.girth_cm + ' cm' : null),
          row('Height at pectoral fin', app.height_cm ? app.height_cm + ' cm' : null),
        ].join(''))}

        ${section('Event Details', [
          row('Date speared', app.date_speared),
          row('Location', app.location),
          row('Hunt description', app.hunt_description),
        ].join(''))}

        ${section('Scales', [
          row('Scales location', app.scales_location),
          row('Manufacturer', app.scales_manufacturer),
          row('Date last certified', app.scales_certified_date),
        ].join(''))}

        ${section('Weighmaster', [
          row('Full name', app.weighmaster_name),
          row('Weight recorded', app.weighmaster_weight_kg ? app.weighmaster_weight_kg + ' kg' : null),
          row('Email', app.weighmaster_email),
          row('Phone', app.weighmaster_phone),
          row('Address', app.weighmaster_address),
          row('Form signed', app.weighmaster_signed),
        ].join(''))}

        ${section('Witness', [
          row('Full name', app.witness_name),
          row('Email', app.witness_email),
          row('Phone', app.witness_phone),
          row('Address', app.witness_address),
          row('Confirmed rules', app.witness_signed),
        ].join(''))}

        ${section('Declaration', `<tr><td colspan="2" style="padding:8px 12px;background:${app.declaration_agreed ? '#f0fdf4' : '#fef2f2'};border-radius:6px;color:${app.declaration_agreed ? '#166534' : '#991b1b'};font-size:13px">
          ${app.declaration_agreed
            ? '✓ Applicant confirmed this fish was speared according to NZ spearfishing record rules and all information is correct.'
            : '✗ Declaration was NOT agreed to.'}
        </td></tr>`)}

        ${app.admin_notes ? section('Admin Notes', `<tr><td colspan="2" style="padding:8px 12px;background:#fffbeb;border-radius:6px;color:#78350f;font-size:13px;white-space:pre-wrap">${fv(app.admin_notes)}</td></tr>`) : ''}

        <h3 style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${SNZ_BLUE};border-left:3px solid ${SNZ_BLUE};padding:4px 0 4px 10px;margin:20px 0 8px">Photos (${photos.length}/9 submitted)</h3>
        <table style="width:100%">${photoRows.join('')}</table>

        <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
          <span>Spearfishing New Zealand Inc · records@spearfishingnz.co.nz</span>
          <span>Application #${app.id} · Generated ${new Date().toLocaleDateString('en-NZ')}</span>
        </div>
      </body></html>`

    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snz-record-app-${app.id}-${(app.full_name || 'unknown').replace(/\s+/g, '-').toLowerCase()}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
      Loading application…
    </div>
  )

  if (!app) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
      Application not found.
    </div>
  )

  const photos = Object.entries(PHOTO_LABELS).filter(([key]) => app[key])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f5f5f5; }
        .no-print { background: #fff; padding: 12px 24px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
        .no-print button { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; transition: opacity .15s; }
        .no-print button:hover { opacity: .85; }
        .page { max-width: 800px; margin: 24px auto; background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .doc-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid ${SNZ_BLUE}; }
        .doc-header-left { display: flex; align-items: center; gap: 16px; }
        .doc-header img { height: 56px; object-fit: contain; }
        .doc-title { font-size: 22px; font-weight: 900; color: #111; margin-bottom: 2px; }
        .doc-subtitle { font-size: 12px; color: #888; letter-spacing: .08em; text-transform: uppercase; }
        .doc-meta { text-align: right; font-size: 11px; color: #888; line-height: 1.8; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .status-submitted { background: #fef9c3; color: #854d0e; }
        .status-approved { background: #dcfce7; color: #166534; }
        .status-provisional { background: #f3e8ff; color: #6b21a8; }
        .status-declined { background: #fee2e2; color: #991b1b; }
        .status-under_review { background: #dbeafe; color: #1e40af; }
        .section { margin-bottom: 24px; break-inside: avoid; }
        .section-title { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${SNZ_BLUE}; padding: 6px 0 6px 10px; border-left: 3px solid ${SNZ_BLUE}; margin-bottom: 10px; }
        .row { display: flex; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .label { width: 200px; flex-shrink: 0; color: #6b7280; font-weight: 500; }
        .value { color: #111; flex: 1; }
        .value.pre { white-space: pre-wrap; line-height: 1.6; }
        .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 4px; }
        .photo-item { break-inside: avoid; }
        .photo-item img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }
        .photo-label { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.3; }
        .photo-missing { width: 100%; aspect-ratio: 4/3; border-radius: 6px; border: 2px dashed #fca5a5; background: #fef2f2; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #ef4444; font-weight: 600; }
        .declaration-box { background: ${app.declaration_agreed ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${app.declaration_agreed ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: ${app.declaration_agreed ? '#166534' : '#991b1b'}; }
        .admin-notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #78350f; white-space: pre-wrap; line-height: 1.6; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff; }
          .no-print { display: none !important; }
          .page { margin: 0; padding: 24px 32px; box-shadow: none; border-radius: 0; max-width: 100%; }
          .photos-grid { grid-template-columns: repeat(3, 1fr); }
          .section { break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print">
        <button onClick={() => navigate('/records/admin?tab=applications')} style={{ background: '#f3f4f6', color: '#374151' }}>← Back to Admin</button>
        <button onClick={handlePrint} style={{ background: SNZ_BLUE, color: '#fff' }}>
          {printing ? 'Opening print dialog…' : '🖨 Print / Save as PDF'}
        </button>
        <button onClick={exportToWord} style={{ background: '#16a34a', color: '#fff' }}>
          📝 Download Word (.doc)
        </button>
        <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 4 }}>PDF: use "Save as PDF" in print dialog</span>
      </div>

      <div className="page">
        {/* Header */}
        <div className="doc-header">
          <div className="doc-header-left">
            {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" />}
            <div>
              <div className="doc-title">NZ Spearfishing Record Application</div>
              <div className="doc-subtitle">Spearfishing New Zealand · Official Record</div>
            </div>
          </div>
          <div className="doc-meta">
            <span className={`status-badge status-${app.status?.replace(' ', '_')}`}>{app.status}</span>
            <br/>
            ID #{app.id}<br/>
            Submitted: {new Date(app.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
            Type: <strong>{app.app_type}</strong>
          </div>
        </div>

        {/* Personal */}
        <Section title="Applicant Details">
          <Row label="Full name" value={app.full_name} />
          <Row label="Email" value={app.email} />
          <Row label="Cell phone" value={app.cell_phone} />
          <Row label="Telephone" value={app.telephone} />
          <Row label="Date of birth" value={app.birth_date} />
          <Row label="Postal address" value={app.postal_address} />
        </Section>

        {/* Species & Measurements */}
        <Section title="Species & Measurements">
          <Row label="Common name" value={app.common_name} />
          <Row label="Scientific name" value={app.scientific_name} />
          <Row label="Weight (applicant)" value={app.weight_kg ? `${app.weight_kg} kg` : null} />
          <Row label="Length" value={app.length_cm ? `${app.length_cm} cm` : null} />
          <Row label="Girth at pectoral fin" value={app.girth_cm ? `${app.girth_cm} cm` : null} />
          <Row label="Height at pectoral fin" value={app.height_cm ? `${app.height_cm} cm` : null} />
        </Section>

        {/* Event */}
        <Section title="Event Details">
          <Row label="Date speared" value={app.date_speared} />
          <Row label="Location" value={app.location} />
          {app.hunt_description && (
            <div className="row">
              <span className="label">Hunt description</span>
              <span className="value pre">{app.hunt_description}</span>
            </div>
          )}
        </Section>

        {/* Scales */}
        <Section title="Scales">
          <Row label="Scales location" value={app.scales_location} />
          <Row label="Manufacturer" value={app.scales_manufacturer} />
          <Row label="Date last certified" value={app.scales_certified_date} />
        </Section>

        {/* Weighmaster */}
        <Section title="Weighmaster">
          <Row label="Full name" value={app.weighmaster_name} />
          <Row label="Weight recorded" value={app.weighmaster_weight_kg ? `${app.weighmaster_weight_kg} kg` : null} />
          <Row label="Email" value={app.weighmaster_email} />
          <Row label="Phone" value={app.weighmaster_phone} />
          <Row label="Address" value={app.weighmaster_address} />
          <Row label="Form signed" value={app.weighmaster_signed} />
        </Section>

        {/* Witness */}
        <Section title="Witness">
          <Row label="Full name" value={app.witness_name} />
          <Row label="Email" value={app.witness_email} />
          <Row label="Phone" value={app.witness_phone} />
          <Row label="Address" value={app.witness_address} />
          <Row label="Confirmed rules" value={app.witness_signed} />
        </Section>

        {/* Declaration */}
        <Section title="Declaration">
          <div className="declaration-box">
            {app.declaration_agreed
              ? '✓ Applicant confirmed that this fish was speared according to the rules for New Zealand spearfishing records and that all information supplied is correct.'
              : '✗ Declaration was NOT agreed to.'}
          </div>
        </Section>

        {/* Admin notes */}
        {app.admin_notes && (
          <Section title="Admin Notes">
            <div className="admin-notes">{app.admin_notes}</div>
          </Section>
        )}

        {/* Photos */}
        <Section title={`Photos (${photos.length}/9 submitted)`}>
          {photos.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No photos submitted.</p>
          ) : (
            <div className="photos-grid">
              {Object.entries(PHOTO_LABELS).map(([key, label]) => (
                <div className="photo-item" key={key}>
                  {app[key] ? (
                    <>
                      <img
                        src={app[key]}
                        alt={label}
                        onError={() => setImgErrors(e => ({ ...e, [key]: true }))}
                        style={imgErrors[key] ? { display: 'none' } : {}}
                      />
                      {imgErrors[key] && <div className="photo-missing">Image unavailable</div>}
                    </>
                  ) : (
                    <div className="photo-missing">Not submitted</div>
                  )}
                  <div className="photo-label">{label}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer */}
        <div className="footer">
          <span>Spearfishing New Zealand Inc · records@spearfishingnz.co.nz</span>
          <span>Application #{app.id} · Generated {new Date().toLocaleDateString('en-NZ')}</span>
        </div>
      </div>
    </>
  )
}
