import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material'
import React from 'react'
import { FiX } from 'react-icons/fi'
import { brand } from '../../../theme/brand'

const BRAND_INK = brand.colors.ink

interface CustomDialogProps {
  open: boolean
  onClose: () => void
  title?: string | React.ReactElement
  children: React.ReactNode
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  borderRadius?: number
  footer?: React.ReactNode
  width?: string
  fullScreen?: boolean
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 'sm',
  footer,
  fullScreen,
  width,
}) => {
  return (
    <Dialog
      open={open}
      fullScreen={fullScreen}
      onClose={onClose}
      fullWidth
      maxWidth={width ? false : maxWidth}
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 0,
          background: '#FFFFFF',
          border: `1px solid ${brand.colors.border}`,
          color: BRAND_INK,
          boxShadow: '0 28px 80px rgba(35, 41, 93, 0.14)',
          minWidth: { xs: 'unset', sm: 360 },
          mx: { xs: 1, sm: 0 },
          width: width || 'auto',
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          pt: { xs: 2.4, sm: 2.7 },
          pb: { xs: 1.6, sm: 1.8 },
          px: { xs: 2.2, sm: 2.8 },
          fontWeight: 700,
          fontSize: { xs: '1rem', sm: '1.08rem' },
          color: BRAND_INK,
          borderBottom: `1px solid ${brand.colors.border}`,
          background:
            'radial-gradient(circle at 16% 0%, rgba(51, 61, 129, 0.08) 0%, transparent 28%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        }}
      >
        {typeof title === 'string' ? (
          <Box>
            <Typography
              sx={{
                fontSize: '0.72rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: brand.colors.primary,
                fontWeight: 800,
                mb: 0.6,
              }}
            >
              IntelExpress
            </Typography>
            <Typography component="div" sx={{ fontSize: { xs: '1rem', sm: '1.08rem' }, fontWeight: 800, color: BRAND_INK }}>
              {title}
            </Typography>
          </Box>
        ) : (
          title
        )}
          <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: { xs: 10, sm: 14 },
            top: { xs: 12, sm: 14 },
            color: brand.colors.primaryDark,
            bgcolor: '#F4F7FF',
            width: { xs: 36, sm: 38 },
            height: { xs: 36, sm: 38 },
            '&:hover': {
              bgcolor: '#E9EDFA',
            },
            borderRadius: 1.5,
            border: `1px solid ${brand.colors.border}`,
          }}
          aria-label="Close dialog"
        >
          <FiX size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          p: { xs: 2.2, sm: 2.8 },
          mt: 0,
          bgcolor: '#FFFFFF',
        }}
      >
        {children}
      </DialogContent>

      {footer && (
        <DialogActions
          sx={{
            borderTop: `1px solid ${brand.colors.border}`,
            p: { xs: 1.8, sm: 2.2 },
            bgcolor: '#F8FBFF',
            gap: 1.5,
          }}
        >
          {footer}
        </DialogActions>
      )}
    </Dialog>
  )
}

export default CustomDialog
