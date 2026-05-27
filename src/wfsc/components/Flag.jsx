// Image-based flags for consistent display
export function Flag({ name, size = 32 }) {
  // Map country names to flag image files
  const flagMap = {
    'New Zealand': 'new-zealand',
    'Australia': 'australia',
    'USA': 'usa',
    'United States': 'usa',
    'Hawaii': 'hawaii',
    'Guam': 'guam',
    'Guam, USA': 'guam',
    'Cuba': 'cuba',
    'Singapore': 'singapore',
    'Portugal': 'portugal',
    'England': 'england',
    'Ghana': 'ghana',
    'China': 'china',
  }
  
  const flagFile = flagMap[name] || 'new-zealand'
  
  return (
    <img 
      src={`/flags/${flagFile}.jpg`} 
      alt={name}
      style={{ 
        width: size, 
        height: size * 0.65, 
        objectFit: 'contain',
        borderRadius: 3,
        display: 'inline-block',
        verticalAlign: 'middle',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
      }}
    />
  )
}
