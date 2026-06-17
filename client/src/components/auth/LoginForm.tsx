import { Box, Stack, Typography } from '@mui/material'
import BrandMark from '../brand/BrandMark'
import { brand } from '../../theme/brand'
import PhoneForm from './PhoneForm'

const BRAND_BLUE = brand.colors.primary
const BRAND_RED = '#D90416'
const CARD_BORDER = '1px solid rgba(22, 34, 70, 0.08)'

const statCards = [
  ['25+', 'Courier Partners'],
  ['10K+', 'Deliveries'],
  ['99.9%', 'On-Time Delivery'],
  ['24x7', 'Support'],
]

export default function LoginForm() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        background:
          'radial-gradient(circle at 10% 16%, rgba(51, 61, 129, 0.08) 0%, transparent 24%), radial-gradient(circle at 90% 14%, rgba(217, 4, 22, 0.08) 0%, transparent 20%), linear-gradient(180deg, #f7f9ff 0%, #eef3fb 100%)',
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1460,
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(420px, 0.85fr)' },
          gap: { xs: 2, lg: 3 },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 'auto', lg: 'calc(100vh - 48px)' },
            px: { xs: 2, sm: 3.5, lg: 4.5 },
            py: { xs: 2.5, sm: 3.5, lg: 4.5 },
            position: 'relative',
            overflow: 'hidden',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(246,249,255,0.96) 100%)',
            border: CARD_BORDER,
            borderRadius: 0,
            boxShadow: '0 18px 48px rgba(17, 24, 39, 0.06)',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <BrandMark width={230} sx={{ mb: 4, maxWidth: '100%' }} />

            <Stack spacing={1.2} sx={{ maxWidth: 580 }}>
              <Typography
                sx={{
                  fontSize: { xs: '2.05rem', sm: '2.7rem', lg: '3.2rem' },
                  fontWeight: 900,
                  letterSpacing: '-0.05em',
                  lineHeight: 1.02,
                  color: '#13255d',
                }}
              >
                Smarter Shipping.
                <br />
                Stronger Business.
              </Typography>

              <Typography
                sx={{
                  color: '#5f6a86',
                  fontSize: { xs: '1rem', sm: '1.05rem' },
                  lineHeight: 1.7,
                  maxWidth: 470,
                }}
              >
                Manage shipments, track deliveries and grow your business with confidence.
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: { xs: 420, lg: 560 },
              mt: { xs: 3, lg: 5 },
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 0,
              background:
                'linear-gradient(180deg, rgba(242,247,255,0.95) 0%, rgba(228,236,249,0.95) 100%)',
              border: '1px solid rgba(29, 52, 112, 0.06)',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0.7,
                backgroundImage:
                  'radial-gradient(circle at 50% 50%, rgba(30, 87, 210, 0.06) 0 2px, transparent 2px)',
                backgroundSize: '18px 18px',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                left: { xs: 18, sm: 32, lg: 46 },
                top: { xs: 36, lg: 56 },
                width: { xs: 148, sm: 180 },
                height: { xs: 148, sm: 180 },
                borderRadius: 0,
                border: '1px solid rgba(16, 74, 183, 0.08)',
                background: 'rgba(255,255,255,0.55)',
                boxShadow: '0 12px 30px rgba(15, 35, 82, 0.06)',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                right: { xs: 24, sm: 42, lg: 70 },
                top: { xs: 84, lg: 120 },
                width: { xs: 172, sm: 196 },
                height: { xs: 86, sm: 96 },
                background: '#fff',
                border: CARD_BORDER,
                borderRadius: 0,
                boxShadow: '0 12px 28px rgba(20, 30, 60, 0.07)',
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 800, color: '#16245f', mb: 0.5 }}>In Transit</Typography>
              <Typography sx={{ color: '#607087', fontSize: '0.9rem' }}>Mumbai → Bengaluru</Typography>
              <Box
                sx={{
                  mt: 1.8,
                  height: 4,
                  borderRadius: 0,
                  background:
                    'linear-gradient(90deg, #2758d6 0%, #2758d6 28%, #d6dbe8 28%, #d6dbe8 100%)',
                }}
              />
            </Box>

            <Box
              sx={{
                position: 'absolute',
                left: { xs: 44, sm: 70, lg: 86 },
                bottom: { xs: 122, sm: 132, lg: 150 },
                width: { xs: 62, sm: 76, lg: 88 },
                height: { xs: 62, sm: 76, lg: 88 },
                borderRadius: '50%',
                background: `radial-gradient(circle at 50% 50%, ${BRAND_RED} 0 34%, rgba(217,4,22,0.18) 34% 100%)`,
                boxShadow: '0 10px 24px rgba(217, 4, 22, 0.18)',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                right: { xs: 48, sm: 80, lg: 118 },
                bottom: { xs: 110, sm: 120, lg: 146 },
                width: { xs: 64, sm: 80, lg: 92 },
                height: { xs: 64, sm: 80, lg: 92 },
                borderRadius: '50%',
                background: `radial-gradient(circle at 50% 50%, #2456de 0 34%, rgba(36,86,222,0.18) 34% 100%)`,
                boxShadow: '0 10px 24px rgba(36, 86, 222, 0.18)',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                left: { xs: 92, sm: 148, lg: 184 },
                right: { xs: 72, sm: 124, lg: 160 },
                top: { xs: 250, sm: 280, lg: 312 },
                height: 4,
                background:
                  'repeating-linear-gradient(90deg, #2758d6 0 14px, transparent 14px 24px)',
                opacity: 0.9,
                transform: 'rotate(-8deg)',
                transformOrigin: 'center',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                left: { xs: 36, sm: 48, lg: 62 },
                bottom: { xs: 40, sm: 58, lg: 72 },
                width: { xs: 220, sm: 320, lg: 430 },
                height: { xs: 124, sm: 160, lg: 188 },
                borderRadius: 0,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(229,238,251,0.98) 100%)',
                boxShadow: '0 18px 36px rgba(18, 36, 82, 0.10)',
                border: '1px solid rgba(22, 34, 70, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'skewX(-10deg)',
              }}
            >
              <Box
                sx={{
                  width: '82%',
                  height: '62%',
                  borderRadius: 0,
                  background:
                    'linear-gradient(180deg, #fefefe 0%, #f4f7fc 100%)',
                  border: '1px solid rgba(22, 34, 70, 0.06)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#1a2d73',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  fontSize: { xs: '1rem', sm: '1.15rem' },
                  transform: 'skewX(10deg)',
                }}
              >
                Intlexpress
              </Box>
            </Box>

            <Box
              sx={{
                position: 'absolute',
                left: { xs: 24, sm: 44, lg: 54 },
                bottom: { xs: 188, sm: 214, lg: 244 },
                width: { xs: 92, sm: 110, lg: 132 },
                height: { xs: 120, sm: 136, lg: 152 },
                borderRadius: 0,
                background:
                  'linear-gradient(180deg, #f2f6ff 0%, #dfe8fb 100%)',
                border: '1px solid rgba(22, 34, 70, 0.06)',
                boxShadow: '0 14px 28px rgba(20, 30, 60, 0.08)',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: { xs: 168, sm: 220, lg: 260 },
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(230, 238, 251, 0.85) 100%)',
              }}
            />
          </Box>

          <Box
            sx={{
              mt: 2.5,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.1,
            }}
          >
            {statCards.map(([value, label]) => (
              <Box
                key={label}
                sx={{
                  border: CARD_BORDER,
                  borderRadius: 0,
                  background: 'rgba(255,255,255,0.78)',
                  boxShadow: '0 10px 24px rgba(17, 24, 39, 0.05)',
                  p: 1.6,
                }}
              >
                <Typography sx={{ color: BRAND_BLUE, fontWeight: 900, fontSize: '1.2rem', lineHeight: 1 }}>
                  {value}
                </Typography>
                <Typography sx={{ color: '#66758f', mt: 0.6, fontSize: '0.82rem' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            minHeight: { xs: 'auto', lg: 'calc(100vh - 48px)' },
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            background: 'transparent',
          }}
        >
          <Box
            sx={{
              width: '100%',
              background: '#ffffff',
              border: CARD_BORDER,
              borderRadius: 0,
              boxShadow: '0 18px 48px rgba(17, 24, 39, 0.08)',
              p: { xs: 2.2, sm: 3, lg: 3.6 },
            }}
          >
            <Box sx={{ mb: 3.5 }}>
              <BrandMark width={190} sx={{ mb: 2, maxWidth: '100%' }} />
              <Typography
                sx={{
                  color: '#10255c',
                  fontWeight: 900,
                  fontSize: { xs: '1.55rem', sm: '1.85rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.12,
                  mb: 0.8,
                }}
              >
                Welcome Back!
              </Typography>
              <Typography sx={{ color: '#6b7590', fontSize: '0.98rem', lineHeight: 1.6 }}>
                Login to your IntelExpress account
              </Typography>
            </Box>

            <PhoneForm />

            <Typography
              sx={{
                mt: 2.8,
                textAlign: 'center',
                color: '#75819d',
                fontSize: '0.82rem',
              }}
            >
              Secure login • Your data is protected
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
