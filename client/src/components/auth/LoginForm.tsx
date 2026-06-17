import { Box } from '@mui/material'
import PhoneForm from './PhoneForm'

export default function LoginForm() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        background: '#f3f6fe',
        px: { xs: 1.5, md: 3 },
        py: { xs: 1.5, md: 3 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1510,
          mx: 'auto',
          minHeight: { xs: 'auto', lg: 'calc(100vh - 24px)' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.12fr 0.88fr' },
          gap: { xs: 1.5, lg: 2.5 },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            minHeight: { lg: 'calc(100vh - 24px)' },
            backgroundImage: 'url(/images/login-reference.jpeg)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left center',
            backgroundSize: 'cover',
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: '0 16px 42px rgba(21, 30, 55, 0.04)',
          }}
        />

        <Box
          sx={{
            minHeight: { xs: 'auto', lg: 'calc(100vh - 24px)' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gridColumn: { xs: '1', lg: 'auto' },
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: 720, lg: 'none' },
              height: '100%',
              background: '#ffffff',
              borderRadius: { xs: '20px', sm: '24px', lg: '26px' },
              boxShadow: '0 18px 45px rgba(21, 30, 55, 0.08)',
              border: '1px solid rgba(20, 31, 60, 0.06)',
              overflow: 'hidden',
              px: { xs: 1.5, sm: 3.5, lg: 4 },
              py: { xs: 1.5, sm: 3.3, lg: 3.8 },
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
              <PhoneForm />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
