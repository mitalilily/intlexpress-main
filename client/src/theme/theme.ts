import { alpha, createTheme } from '@mui/material/styles'
import { brand } from './brand'

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 300,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  palette: {
    mode: 'light',
    primary: {
      main: brand.colors.primary,
      light: brand.colors.primaryLight,
      dark: brand.colors.primaryDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.colors.accent,
      light: brand.colors.accentLight,
      dark: brand.colors.accentDark,
      contrastText: '#FFFFFF',
    },
    background: {
      default: brand.colors.canvas,
      paper: brand.colors.surface,
    },
    text: {
      primary: brand.colors.ink,
      secondary: brand.colors.slate,
      disabled: '#AAA4A0',
    },
    divider: brand.colors.border,
    error: {
      main: '#C62828',
    },
    warning: {
      main: '#C97A12',
    },
    info: {
      main: '#2563EB',
    },
    success: {
      main: '#00a986',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
    h1: {
      color: brand.colors.ink,
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h2: {
      color: brand.colors.ink,
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h3: {
      color: brand.colors.ink,
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h4: {
      color: brand.colors.ink,
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h5: { color: brand.colors.ink, fontWeight: 760, letterSpacing: '-0.02em' },
    h6: { color: brand.colors.ink, fontWeight: 760, letterSpacing: '-0.02em' },
    subtitle1: { color: brand.colors.slate, fontWeight: 700 },
    subtitle2: { color: brand.colors.muted, fontWeight: 700, letterSpacing: '0.03em' },
    body1: { color: brand.colors.slate, lineHeight: 1.65 },
    body2: { color: brand.colors.muted, lineHeight: 1.55 },
    button: { fontWeight: 800, textTransform: 'none', letterSpacing: '0.01em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        body: {
          color: brand.colors.ink,
          background:
            'radial-gradient(circle at 0 0, rgba(51, 61, 129, 0.10), transparent 26%), radial-gradient(circle at 84% 8%, rgba(206, 40, 38, 0.08), transparent 24%), linear-gradient(#ffffff, #f6f7fb 38%, #eef1f9)',
          backgroundAttachment: 'fixed',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          backgroundColor: alpha(brand.colors.surface, 0.98),
          border: `1px solid ${brand.colors.border}`,
          boxShadow: '0 24px 70px rgba(35, 41, 93, 0.08)',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: '0 !important',
          paddingRight: '0 !important',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
          minHeight: 42,
          fontWeight: 800,
          '&.Mui-disabled': {
            opacity: 0.72,
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primaryDark} 100%)`,
          color: '#FFFFFF',
          '&:hover': {
            background: `linear-gradient(135deg, ${brand.colors.primaryDark} 0%, #11163f 100%)`,
            boxShadow: `0 16px 32px ${alpha(brand.colors.primary, 0.28)}`,
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${brand.colors.accent} 0%, ${brand.colors.accentDark} 100%)`,
          color: '#FFFFFF',
          '&:hover': {
            background: `linear-gradient(135deg, ${brand.colors.accentDark} 0%, #861917 100%)`,
            boxShadow: `0 16px 30px ${alpha(brand.colors.accent, 0.28)}`,
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: alpha(brand.colors.ink, 0.12),
          color: brand.colors.ink,
          backgroundColor: alpha(brand.colors.surface, 0.86),
          '&:hover': {
            borderWidth: 1,
            borderColor: alpha(brand.colors.primary, 0.24),
            backgroundColor: alpha(brand.colors.primary, 0.05),
          },
        },
        text: {
          color: brand.colors.primaryDark,
          '&:hover': {
            backgroundColor: alpha(brand.colors.primary, 0.06),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 800,
          letterSpacing: '0.03em',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
          root: {
          borderRadius: 20,
          backgroundColor: alpha(brand.colors.surfaceAlt, 0.96),
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          '& fieldset': {
            borderColor: alpha(brand.colors.ink, 0.1),
          },
          '&:hover fieldset': {
            borderColor: alpha(brand.colors.primary, 0.26),
          },
          '&.Mui-focused': {
            backgroundColor: brand.colors.surface,
            boxShadow: `0 0 0 4px ${alpha(brand.colors.primary, 0.08)}`,
          },
          '&.Mui-focused fieldset': {
            borderColor: brand.colors.primary,
          },
        },
        input: {
          paddingTop: 13,
          paddingBottom: 13,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: brand.colors.muted,
          fontWeight: 600,
          '&.Mui-focused': {
            color: brand.colors.primary,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(brand.colors.surface, 0.92),
          color: brand.colors.ink,
          border: `1px solid ${alpha(brand.colors.ink, 0.06)}`,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 12px 32px rgba(35, 41, 93, 0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(brand.colors.ink, 0.08),
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: brand.colors.surfaceAlt,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brand.colors.ink,
          fontWeight: 800,
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: `1px solid ${alpha(brand.colors.ink, 0.08)}`,
        },
        body: {
          color: brand.colors.slate,
          borderBottom: `1px solid ${alpha(brand.colors.ink, 0.06)}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha(brand.colors.primary, 0.025),
          },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          paddingInline: 8,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${brand.colors.primary} 0%, ${brand.colors.primaryLight} 100%)`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 46,
          fontWeight: 800,
          color: brand.colors.muted,
          '&.Mui-selected': {
            color: brand.colors.primaryDark,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          border: `1px solid ${alpha(brand.colors.ink, 0.08)}`,
          boxShadow: '0 28px 70px rgba(35, 41, 93, 0.14)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          border: `1px solid ${alpha(brand.colors.ink, 0.08)}`,
          boxShadow: '0 24px 50px rgba(35, 41, 93, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
})

export default theme
