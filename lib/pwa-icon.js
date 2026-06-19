/** Shared FloraChemist app icon markup for next/og ImageResponse routes. */
export function pwaIconMarkup(size) {
  const fontSize = Math.round(size * 0.42);
  const radius = Math.round(size * 0.22);
  return {
    width: size,
    height: size,
    element: (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
          borderRadius: radius,
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          +
        </div>
      </div>
    ),
  };
}
