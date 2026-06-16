import { Box, type BoxProps } from '@mui/material'
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
  const src = variant === 'icon' ? brand.icon : brand.logo

  return (
    <Box
      component="img"
      src={src}
      alt={variant === 'icon' ? `${brand.name} logo mark` : `${brand.name} logo`}
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
