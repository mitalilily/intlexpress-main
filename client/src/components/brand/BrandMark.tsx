import { Box, Typography, type BoxProps } from '@mui/material'
import { brand } from '../../theme/brand'

type BrandMarkProps = BoxProps & {
  variant?: 'full' | 'icon'
  width?: number | string
}

export default function BrandMark({
  variant = 'full',
  width = 220,
  sx,
  ...props
}: BrandMarkProps) {
  if (variant === 'icon') {
    return (
      <Box
        component="img"
        src={brand.icon}
        alt={`${brand.name} logo mark`}
        loading="eager"
        decoding="async"
        sx={{
          width,
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          userSelect: 'none',
          ...sx,
        }}
        {...props}
      />
    )
  }

  return (
    <Box
      role="img"
      aria-label={`${brand.name} logo`}
      sx={{
        width,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.2,
        userSelect: 'none',
        ...sx,
      }}
      {...props}
    >
      <Box
        component="img"
        src={brand.icon}
        alt={`${brand.name} logo mark`}
        loading="eager"
        decoding="async"
        sx={{
          width: 42,
          height: 42,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '1.2rem',
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: brand.colors.ink,
            whiteSpace: 'nowrap',
          }}
        >
          {brand.name}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.56rem',
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: brand.colors.slate,
            mt: 0.45,
            whiteSpace: 'nowrap',
          }}
        >
          {brand.tagline}
        </Typography>
      </Box>
    </Box>
  )
}
