import { Box, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/auth/AuthContext'
import { brand } from '../../theme/brand'
import Navbar from '../Navbar/Navbar'
import KeyboardShortcuts from './keyboard/KeyboardShortcuts'
import Sidebar from './Sidebar'

export default function Layout() {
  const theme = useTheme()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const { user } = useAuth()
  const isAdminWorkspace =
    user.role === 'admin' || user.role === 'employee' || Boolean(user.employeeId)
  const isOrderCreatePage = location.pathname === '/orders/create'

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev)
  }

  // Close mobile drawer on route change
  useEffect(() => {
    if (isMobile && mobileOpen) {
      setMobileOpen(false)
    }
  }, [location.pathname, isMobile, mobileOpen])

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 0 0, rgba(51, 61, 129, 0.08) 0%, transparent 28%), radial-gradient(circle at 84% 8%, rgba(206, 40, 38, 0.06) 0%, transparent 24%), linear-gradient(180deg, #f6f7fb 0%, #eef1f9 100%)',
        scrollbarGutter: 'stable',
      }}
    >
      <KeyboardShortcuts />

      {isMobile ? (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          variant="temporary"
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
              border: 0,
              background: brand.colors.surface,
              boxShadow: '0 12px 40px rgba(35, 41, 93, 0.12)',
            },
          }}
        >
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Sidebar role={isAdminWorkspace ? 'admin' : 'customer'} />
            </Box>
          </Box>
        </Drawer>
      ) : (
        <Sidebar
          role={isAdminWorkspace ? 'admin' : 'customer'}
          pinned={sidebarPinned}
          onPinChange={setSidebarPinned}
        />
      )}

      <Stack
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          p: 0,
          gap: 0,
          scrollbarGutter: 'stable',
        }}
      >
        <Navbar
          handleDrawerToggle={handleDrawerToggle}
          pinned={sidebarPinned}
          onPinChange={setSidebarPinned}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            p: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
          }}
        >
          <Box
            sx={{
              maxWidth: 1700,
              mx: 'auto',
              width: '100%',
              px: isOrderCreatePage
                ? { xs: 0, sm: 0.25, md: 0.4, lg: 0.5 }
                : { xs: 0.4, sm: 0.8, md: 1.5, lg: 2 },
              py: isOrderCreatePage
                ? 0
                : { xs: 0.6, sm: 1, md: 1.5 },
            }}
          >
            <Suspense
              fallback={
                <Box key={`layout-fallback-${location.pathname}`} sx={{ minHeight: 300 }} />
              }
            >
              <Box key={location.pathname} sx={{ width: '100%', minHeight: '300px' }}>
                <Outlet />
              </Box>
            </Suspense>
          </Box>
        </Box>

        {!isOrderCreatePage && (
          <Box
            sx={{
              maxWidth: 1700,
              mx: 'auto',
              width: '100%',
              px: { xs: 0.6, md: 0.2 },
              pt: 0.4,
              borderTop: `1px solid ${brand.colors.border}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: { xs: 'center', md: 'space-between' },
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                py: 1.5,
                color: 'text.secondary',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Box
                sx={{
                  color: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                IntleExpress - Global Courier Solutions
              </Box>
            </Box>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
